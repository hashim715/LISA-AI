import { iteratePaginatedAPI, Client } from "@notionhq/client";
import {
  BlockObjectResponse,
  PageObjectResponse,
  PartialDatabaseObjectResponse,
  PartialPageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { openai } from "./chatgptFuncs";
import { summarizeNotionWithLLM } from "./chatgptFuncs";

export const getPlainTextFromRichText = (richText: any) => {
  return richText.map((t: any) => t.plain_text).join("");
};

export async function queryDatabase(databaseId: any, notion: any) {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          property: "Created time",
          direction: "descending",
        },
      ],
    });
    return response.results;
  } catch (error) {
    console.error(`Error querying database ${databaseId}:`, error);
    return [];
  }
}

export async function extractDatabaseContent(databaseId: any, notion: any) {
  const pages = await queryDatabase(databaseId, notion);
  let content = "Database Contents:\n\n";

  for (const page of pages) {
    content += "---\n";
    // Extract properties
    for (const [key, value] of Object.entries(page.properties) as [any, any]) {
      let propertyValue = "";

      switch (value.type) {
        case "title":
        case "rich_text":
          propertyValue = getPlainTextFromRichText(value[value.type]);
          break;
        case "number":
          propertyValue = value.number?.toString() || "";
          break;
        case "select":
          propertyValue = value.select?.name || "";
          break;
        case "multi_select":
          propertyValue = value.multi_select
            .map((opt: any) => opt.name)
            .join(", ");
          break;
        case "date":
          propertyValue = value.date?.start || "";
          if (value.date?.end) {
            propertyValue += ` to ${value.date.end}`;
          }
          break;
        case "people":
          propertyValue = value.people
            .map((person: any) => person.name)
            .join(", ");
          break;
        case "files":
          propertyValue = value.files
            .map((file: any) => file.name || file.url)
            .join(", ");
          break;
        case "checkbox":
          propertyValue = value.checkbox ? "Yes" : "No";
          break;
        case "url":
          propertyValue = value.url || "";
          break;
        case "email":
          propertyValue = value.email || "";
          break;
        case "phone_number":
          propertyValue = value.phone_number || "";
          break;
        case "status":
          propertyValue = value.status?.name || "";
          break;
        case "relation":
          propertyValue = value.relation.map((rel: any) => rel.id).join(", ");
          break;
        case "formula":
          propertyValue =
            value.formula?.string || value.formula?.number?.toString() || "";
          break;
        case "rollup":
          propertyValue =
            value.rollup?.array
              ?.map((item: any) => item.name || item.title)
              .join(", ") || "";
          break;
        case "created_time":
          propertyValue = new Date(value.created_time).toLocaleString();
          break;
        case "created_by":
          propertyValue = value.created_by?.name || "";
          break;
        case "last_edited_time":
          propertyValue = new Date(value.last_edited_time).toLocaleString();
          break;
        case "last_edited_by":
          propertyValue = value.last_edited_by?.name || "";
          break;
      }

      if (propertyValue) {
        content += `${key}: ${propertyValue}\n`;
      }
    }
    content += "\n";
  }

  return content;
}

export function getPageTitle(page: any) {
  if (page.properties?.title?.title) {
    return getPlainTextFromRichText(page.properties.title.title);
  } else if (page.properties?.Name?.title) {
    return getPlainTextFromRichText(page.properties.Name.title);
  } else {
    return "Untitled Page";
  }
}

export const retrieveBlockChildren = async (
  id: string,
  level: number = 0,
  notion: Client
): Promise<BlockObjectResponse[]> => {
  const blocks: BlockObjectResponse[] = [];

  try {
    // Get all blocks at this level
    for await (const block of iteratePaginatedAPI(notion.blocks.children.list, {
      block_id: id,
    })) {
      const typedBlock = block as BlockObjectResponse;
      blocks.push(typedBlock);

      // If this block has children, recursively get them
      if (typedBlock.has_children) {
        const childBlocks = await retrieveBlockChildren(
          typedBlock.id,
          level + 1,
          notion
        );
        (typedBlock as any).children = childBlocks; // Type assertion for adding children
      }
    }
  } catch (error) {
    console.error(`Error retrieving children for block ${id}:`, error);
  }

  return blocks;
};

const getMediaSourceText = (block: any) => {
  let source, caption;

  if (block[block.type].external) {
    source = block[block.type].external.url;
  } else if (block[block.type].file) {
    source = block[block.type].file.url;
  } else if (block[block.type].url) {
    source = block[block.type].url;
  } else {
    source = "[Missing case for media blocks]: " + block.type;
  }
  // If there's a caption, return it with the source
  if (block[block.type].caption.length) {
    caption = getPlainTextFromRichText(block[block.type].caption);
    return caption + ": " + source;
  }
  // If no caption, just return the source URL
  return source;
};

const getTextFromBlock = (block: any) => {
  let text;

  // Get rich text from blocks that support it
  if (block[block.type].rich_text) {
    // This will be an empty string if it's an empty line.
    text = getPlainTextFromRichText(block[block.type].rich_text);
  }
  // Get text for block types that don't have rich text
  else {
    switch (block.type) {
      case "unsupported":
        // The public API does not support all block types yet
        text = "[Unsupported block type]";
        break;
      case "bookmark":
        text = block.bookmark.url;
        break;
      case "child_database":
        text = block.child_database.title;
        // Use "Query a database" endpoint to get db rows: https://developers.notion.com/reference/post-database-query
        // Use "Retrieve a database" endpoint to get additional properties: https://developers.notion.com/reference/retrieve-a-database
        break;
      case "child_page":
        text = block.child_page.title;
        break;
      case "embed":
      case "video":
      case "file":
      case "image":
      case "pdf":
        text = getMediaSourceText(block);
        break;
      case "equation":
        text = block.equation.expression;
        break;
      case "link_preview":
        text = block.link_preview.url;
        break;
      case "synced_block":
        // Provides ID for block it's synced with.
        text = block.synced_block.synced_from
          ? "This block is synced with a block with the following ID: " +
            block.synced_block.synced_from[block.synced_block.synced_from.type]
          : "Source sync block that another blocked is synced with.";
        break;
      case "table":
        // Enhanced table handling
        text = `Table with ${block.table.table_width} columns`;
        break;
      case "table_row":
        // Handle table rows
        const cells = block.table_row.cells
          .map((cell: any) =>
            cell.map((textObj: any) => textObj.plain_text).join("")
          )
          .join(" | ");
        text = `Row: ${cells}`;
        break;
      case "table_of_contents":
        // Does not include text from ToC; just the color
        text = "ToC color: " + block.table_of_contents.color;
        break;
      case "breadcrumb":
      case "column_list":
      case "divider":
        text = "No text available";
        break;
      default:
        text = "[Needs case added]";
        break;
    }
  }
  if (block.has_children) {
    text = text + " (Has children)";
  }
  return block.type + ": " + text;
};

function formatBlockContent(block: any, level = 0) {
  let content = "";
  const indent = " ".repeat(level * 2);

  // Format this block's content
  const text = getTextFromBlock(block);
  content += `${indent}${text}\n`;

  // If this block has children, format them too
  if (block.children && block.children.length > 0) {
    for (const childBlock of block.children) {
      content += formatBlockContent(childBlock, level + 1);
    }
  }

  return content;
}

export const formatPageContent = (page: PageObjectResponse, blocks: any) => {
  const pageTitle = getPageTitle(page);
  let content = `Page: ${pageTitle}\nURL: ${page.url}\n\n`;

  // Add page properties if they exist
  if (page.properties) {
    content += "Properties:\n";
    for (const [key, value] of Object.entries(page.properties) as [any, any]) {
      if (value.type === "title" || value.type === "rich_text") {
        const text = getPlainTextFromRichText(value[value.type]);
        if (text) content += `${key}: ${text}\n`;
      } else if (value.type === "date" && value.date) {
        content += `${key}: ${value.date.start}${
          value.date.end ? ` to ${value.date.end}` : ""
        }\n`;
      } else if (value.type === "select" && value.select) {
        content += `${key}: ${value.select.name}\n`;
      } else if (value.type === "multi_select" && value.multi_select) {
        const options = value.multi_select
          .map((opt: any) => opt.name)
          .join(", ");
        content += `${key}: ${options}\n`;
      } else if (value.type === "number" && value.number !== null) {
        content += `${key}: ${value.number}\n`;
      } else if (value.type === "checkbox") {
        content += `${key}: ${value.checkbox ? "Yes" : "No"}\n`;
      } else if (value.type === "url" && value.url) {
        content += `${key}: ${value.url}\n`;
      } else if (value.type === "email" && value.email) {
        content += `${key}: ${value.email}\n`;
      } else if (value.type === "phone_number" && value.phone_number) {
        content += `${key}: ${value.phone_number}\n`;
      } else if (value.type === "status" && value.status) {
        content += `${key}: ${value.status.name}\n`;
      } else if (value.type === "people") {
        // Enhanced people property handling
        const people = value.people || [];
        if (people.length > 0) {
          const names = people
            .map((person: any) => {
              // Handle different types of person objects
              if (person.name) return person.name;
              if (person.person?.email) return person.person.email;
              return "Unknown User";
            })
            .join(", ");
          content += `${key}: ${names}\n`;
        } else {
          content += `${key}: Unassigned\n`;
        }
      } else if (
        value.type === "created_by" ||
        value.type === "last_edited_by"
      ) {
        // Handle created_by and last_edited_by properties
        const person = value[value.type];
        content += `${key}: ${person.name || person.id || "Unknown"}\n`;
      }
    }
    content += "\n";
  }

  content += "Content:\n";
  // Format each block and its children
  for (const block of blocks) {
    content += formatBlockContent(block);
  }

  return content;
};

export const getAllPages = async (notion: Client) => {
  const pages: Array<any> = [];

  try {
    for await (const page of iteratePaginatedAPI(notion.search, {
      filter: {
        property: "object",
        value: "page",
      },
    })) {
      pages.push(page);
    }

    return pages;
  } catch (error) {
    return [];
  }
};

export const selectTaskListPage = async (
  pages: Array<PartialPageObjectResponse | PartialDatabaseObjectResponse>
) => {
  try {
    const pageTitles = pages.map((page) => getPageTitle(page));

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that analyzes page titles to identify the most relevant task list or to-do list page. Look for titles that suggest task management, to-do lists, or project tracking.",
        },
        {
          role: "user",
          content: `Here are the page titles from a Notion workspace:\n\n${pageTitles.join(
            "\n"
          )}\n\nPlease identify which page is most likely to be a task list or to-do list. Return only the exact title of the most relevant page.`,
        },
      ],
      model: "gpt-3.5-turbo",
    });

    const selectedTitle = completion.choices[0].message.content.trim();
    const selectedIndex = pageTitles.indexOf(selectedTitle);

    if (selectedIndex === -1) {
      console.log(
        "No suitable task list page found. Using the first page instead."
      );
      return pages[0];
    }

    return pages[selectedIndex];
  } catch (error) {
    console.error("Error selecting task list page:", error);
    return pages[0]; // Fallback to first page if there's an error
  }
};

// New function to select page based on user question
export const selectPageBasedOnQuestion = async (
  pages: Array<PageObjectResponse>,
  question: string
) => {
  try {
    const pageTitles = pages.map((page: PageObjectResponse) =>
      getPageTitle(page)
    );

    console.log("Available page titles:", pageTitles);
    console.log("Question being asked:", question);

    // If the question starts with "Page Title:", extract just the title part
    let searchTitle = question;
    if (question.startsWith("Page Title:")) {
      searchTitle = question.replace("Page Title:", "").trim();
    }

    // First try direct match
    const directMatchIndex = pageTitles.findIndex(
      (title: string) =>
        title.trim().toLowerCase() === searchTitle.toLowerCase()
    );

    if (directMatchIndex !== -1) {
      return { page: pages[directMatchIndex] };
    }

    // If no direct match, try partial match
    const partialMatchIndex = pageTitles.findIndex(
      (title: string) =>
        title.trim().toLowerCase().includes(searchTitle.toLowerCase()) ||
        searchTitle.toLowerCase().includes(title.trim().toLowerCase())
    );

    if (partialMatchIndex !== -1) {
      return {
        page: pages[partialMatchIndex],
        matchedTitle: pageTitles[partialMatchIndex],
      };
    }

    // If still no match, try using LLM
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that analyzes page titles to identify which page would be most relevant to answer a user's question. Consider the context and content that would likely be in each page based on its title. Return only the exact title of the most relevant page, or if no page seems relevant, return 'NO_MATCH'.",
        },
        {
          role: "user",
          content: `Here are the page titles from a Notion workspace:\n\n${pageTitles.join(
            "\n"
          )}\n\nUser's question: ${question}\n\nPlease identify which page would be most relevant to answer this question. Return only the exact title of the most relevant page, or 'NO_MATCH' if no page seems relevant.`,
        },
      ],
      model: "gpt-3.5-turbo",
    });

    const selectedTitle = completion.choices[0].message.content.trim();
    console.log("Selected title from LLM:", selectedTitle);

    if (selectedTitle === "NO_MATCH") {
      return { error: "No page seems directly relevant to the question." };
    }

    const selectedIndex = pageTitles.findIndex(
      (title: string) =>
        title.trim().toLowerCase() === selectedTitle.toLowerCase()
    );

    if (selectedIndex === -1) {
      return {
        error: "Selected page title does not match any available pages.",
      };
    }

    return { page: pages[selectedIndex] };
  } catch (error) {
    console.error("Error in selectPageBasedOnQuestion:", error);
    return { error: `Error selecting page: ${error.message}` };
  }
};

// New function to handle the search process
export const searchNotion = async (question: string, notion: Client) => {
  try {
    // Get all pages
    const pages = await getAllPages(notion);

    if (pages.length === 0) {
      return { error: "No pages found in the workspace." };
    }

    // Select the most relevant page based on the question
    const selectionResult = await selectPageBasedOnQuestion(pages, question);

    if (selectionResult.error) {
      return selectionResult;
    }

    const selectedPage = selectionResult.page;
    const pageTitle = getPageTitle(selectedPage);

    // Process the selected page
    const blocks = await retrieveBlockChildren(selectedPage.id, 0, notion);
    const pageContent = formatPageContent(selectedPage, blocks);

    // Generate summary
    const summary = await summarizeNotionWithLLM(pageContent);

    return {
      pageTitle,
      pageUrl: selectedPage.url,
      summary,
      matchedTitle: selectionResult.matchedTitle,
    };
  } catch (error) {
    return { error: `Error processing content: ${error.message}` };
  }
};
