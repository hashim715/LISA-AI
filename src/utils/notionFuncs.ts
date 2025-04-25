import { iteratePaginatedAPI, Client, isFullPage } from "@notionhq/client";
import {
  BlockObjectResponse,
  PageObjectResponse,
  PartialDatabaseObjectResponse,
  PartialPageObjectResponse,
  DatabaseObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { openai } from "./chatgptFuncs";
import { summarizeNotionWithLLM } from "./chatgptFuncs";
import { logger } from "./logger";

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

    const selectedTitle = completion.choices[0].message.content?.trim();
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

    const selectedTitle = completion.choices[0].message.content?.trim();
    console.log("Selected title from LLM:", selectedTitle);

    if (selectedTitle === "NO_MATCH") {
      return { error: "No page seems directly relevant to the question." };
    }

    const selectedIndex = pageTitles.findIndex(
      (title: string) =>
        title.trim().toLowerCase() === selectedTitle?.toLowerCase()
    );

    if (selectedIndex === -1) {
      return {
        error: "Selected page title does not match any available pages.",
      };
    }

    return { page: pages[selectedIndex] };
  } catch (error: any) {
    console.error("Error in selectPageBasedOnQuestion:", error);
    return { error: `Error selecting page: ${error.message}` };
  }
};

// New function to handle the search process
export const searchNotion = async (question: string, notion: Client) => {
  // Get all pages
  const pages = await getAllPages(notion);

  if (pages.length === 0) {
    logger.error("No pages found in the workspace.");
    throw new Error("No pages found in the workspace.");
  }

  // Select the most relevant page based on the question
  const selectionResult = await selectPageBasedOnQuestion(pages, question);

  if (selectionResult.error) {
    logger.error("could not find page matching query");
    throw new Error("could not find page matching query");
  }

  const selectedPage = selectionResult.page;
  const pageTitle = getPageTitle(selectedPage);

  if (!selectedPage) {
    logger.error("could not find page");
    throw new Error("could not find page");
  }

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
};

export const getAllDatabases = async (notion: Client) => {
  const databases = [];
  try {
    for await (const database of iteratePaginatedAPI(notion.search, {
      filter: {
        property: "object",
        value: "database",
      },
    })) {
      databases.push(database);
    }
    return databases;
  } catch (error) {
    logger.error("Error searching for databases:", error);
    return [];
  }
};

export const getDatabaseTitle = (database: any) => {
  if (database.title && database.title.length > 0) {
    return database.title[0].plain_text;
  } else if (database.properties?.Name?.title) {
    return database.properties.Name.title[0].plain_text;
  } else {
    return "Untitled Database";
  }
};

export const selectPageBasedOnInput = async (
  pages: Array<PageObjectResponse>,
  userInput: string
) => {
  try {
    const pageTitles = pages.map((page) => getPageTitle(page));

    console.log("Available page titles:", pageTitles);
    console.log("User input:", userInput);

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that analyzes page titles to identify which page a user is referring to. Return only the exact title of the most relevant page, or if no page seems relevant, return 'NO_MATCH'. Be lenient in matching - if a user's input contains words that match a page title, consider it a match.",
        },
        {
          role: "user",
          content: `Here are the page titles from a Notion workspace:\n\n${pageTitles.join(
            "\n"
          )}\n\nUser's input: ${userInput}\n\nPlease identify which page the user is referring to. Return only the exact title of the most relevant page, or 'NO_MATCH' if no page seems relevant.`,
        },
      ],
      model: "gpt-3.5-turbo",
    });

    const selectedTitle = completion.choices[0].message.content?.trim();
    console.log("LLM selected title:", selectedTitle);

    if (selectedTitle === "NO_MATCH" || !selectedTitle) {
      return null;
    }

    const selectedPage = pages.find(
      (page) => getPageTitle(page).toLowerCase() === selectedTitle.toLowerCase()
    );

    if (!selectedPage) {
      console.log("No exact match found for:", selectedTitle);
      // Try partial match as fallback
      const partialMatch = pages.find(
        (page) =>
          getPageTitle(page)
            .toLowerCase()
            .includes(selectedTitle.toLowerCase()) ||
          selectedTitle.toLowerCase().includes(getPageTitle(page).toLowerCase())
      );
      if (partialMatch) {
        console.log("Found partial match:", getPageTitle(partialMatch));
        return partialMatch;
      }
    }

    return selectedPage;
  } catch (error) {
    console.error("Error selecting page:", error);
    return null;
  }
};

export const updatePageTitle = async (
  pageId: string,
  newTitle: string,
  notion: Client
) => {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        title: {
          title: [
            {
              text: {
                content: newTitle,
              },
            },
          ],
        },
      },
    });
    return true;
  } catch (error) {
    console.error("Error updating page title:", error);
    return false;
  }
};

export const getDatabaseItems = async (databaseId: string, notion: Client) => {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
    });
    return response.results;
  } catch (error) {
    console.error("Error fetching database items:", error);
    return [];
  }
};

export const getItemTitle = (item: any) => {
  // Try different possible title property formats
  if (item.properties?.Name?.title?.[0]?.plain_text) {
    return item.properties.Name.title[0].plain_text;
  } else if (item.properties?.title?.title?.[0]?.plain_text) {
    return item.properties.title.title[0].plain_text;
  } else if (item.properties?.Task?.title?.[0]?.plain_text) {
    return item.properties.Task.title[0].plain_text;
  } else if (item.properties?.Item?.title?.[0]?.plain_text) {
    return item.properties.Item.title[0].plain_text;
  } else {
    // If no title found, try to find any property that might contain the title
    for (const [key, value] of Object.entries(item.properties) as [
      string,
      any
    ][]) {
      if (value.type === "title" && value.title?.[0]?.plain_text) {
        return value.title[0].plain_text;
      }
    }
    return "Untitled Item";
  }
};

export const parseUserInput = async (
  input: string,
  databases: Array<any>,
  items: Array<any>
) => {
  try {
    const databaseTitles = databases.map((db) => getDatabaseTitle(db));
    const itemTitles = items.map((item) => getItemTitle(item));

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that parses user input to identify:
            1. Which database they're referring to
            2. Which item in that database they want to update
            3. What status they want to set (Not started, In progress, or Done)

            Available databases: ${databaseTitles.join(", ")}
            Available items: ${itemTitles.join(", ")}

            Return a JSON object with these fields:
            {
              "database": "exact database title",
              "item": "exact item title",
              "status": "Not started/In progress/Done"
            }

            If you can't identify any of these, use null for that field.`,
        },
        {
          role: "user",
          content: input,
        },
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
    });

    return JSON.parse(completion.choices[0].message.content || "");
  } catch (error) {
    console.error("Error parsing user input:", error);
    return null;
  }
};

export const updateItemStatus = async (
  pageId: string,
  newStatus: string,
  notion: Client
) => {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });

    if (!isFullPage(page)) {
      throw new Error("Retrieved page is not a full page object.");
    }

    const statusProperty = page.properties.Status;
    let updateProperties = {};

    if (statusProperty.type === "status") {
      updateProperties = {
        Status: {
          status: {
            name: newStatus,
          },
        },
      };
    } else if (statusProperty.type === "checkbox") {
      const isChecked = newStatus.toLowerCase() === "done";
      updateProperties = {
        Status: {
          checkbox: isChecked,
        },
      };
    } else {
      throw new Error(
        `Unsupported Status property type: ${statusProperty.type}`
      );
    }

    await notion.pages.update({
      page_id: pageId,
      properties: updateProperties,
    });

    return true;
  } catch (error) {
    logger.error("Error updating item status:", error);
    return false;
  }
};

export const findPage = async (query: string, notion: Client) => {
  try {
    const response = await notion.search({
      query,
      filter: {
        property: "object",
        value: "page",
      },
      sort: {
        direction: "descending",
        timestamp: "last_edited_time",
      },
    });

    return response.results.length > 0 ? response.results[0] : null;
  } catch (error: any) {
    logger.error("❌ Error during search:", error.message);
    return null;
  }
};

export const archivePage = async (pageId: string, notion: Client) => {
  try {
    await notion.pages.update({
      page_id: pageId,
      archived: true,
    });
    logger.info("✅ Successfully archived the page.");
  } catch (error: any) {
    if (
      error.code === "validation_error" &&
      error.message.includes("workspace level pages")
    ) {
      logger.error("❌ Cannot archive workspace-level pages via the API.");
    } else if (error.code === "object_not_found") {
      logger.error("❌ The page ID does not exist or access is denied.");
    } else {
      logger.error("❌ Error archiving page:", error.message);
    }
  }
};

export const parseUserInputForChangeDueDate = async (
  input: string,
  databases: Array<any>,
  items: Array<any>
) => {
  try {
    const databaseTitles = databases.map((db) => getDatabaseTitle(db));
    const itemTitles = items.map((item) => getItemTitle(item));

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that parses user input to identify:
            1. Which database they're referring to
            2. Which item in that database they want to update
            3. What due date they want to set (in YYYY-MM-DD format)

            Available databases: ${databaseTitles.join(", ")}
            Available items: ${itemTitles.join(", ")}

            Return a JSON object with these fields:
            {
              "database": "exact database title",
              "item": "exact item title",
              "dueDate": "YYYY-MM-DD"
            }

            If you can't identify any of these, use null for that field.`,
        },
        {
          role: "user",
          content: input,
        },
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
    });

    return JSON.parse(completion.choices[0].message.content || "");
  } catch (error) {
    console.error("Error parsing user input:", error);
    return null;
  }
};

export const findMostSimilarDatabase = async (
  databases: Array<any>,
  targetName: string
) => {
  try {
    const databaseTitles = databases.map((db) => getDatabaseTitle(db));

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that finds the most similar database name from a list.
            Given a target database name and a list of available databases, return the exact name from the list that is most similar to the target.

            Available databases: ${databaseTitles.join(", ")}

            Return a JSON object with this field:
            {
              "database": "exact database name from the list"
            }

            If no database seems similar, return null.`,
        },
        {
          role: "user",
          content: `Find the database most similar to: "${targetName}"`,
        },
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || "");
    return result.database;
  } catch (error) {
    console.error("Error finding similar database:", error);
    return null;
  }
};

export const updateItemDueDate = async (
  pageId: string,
  newDueDate: string,
  notion: Client
) => {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Due Date": {
          rich_text: [
            {
              type: "text",
              text: {
                content: newDueDate,
              },
            },
          ],
        },
      },
    });
    return true;
  } catch (error) {
    console.error("Error updating item due date:", error);
    return false;
  }
};

// Function to find the most similar database using OpenAI
export const indMostSimilarDatabaseForAddingDatabaseEntry = async (
  databases: Array<any>,
  query: string
) => {
  try {
    // Create a list of database titles
    const databaseTitles = databases.map((db) => getDatabaseTitle(db));

    // Create the prompt for OpenAI
    const prompt = `Given the following list of database names and a user query, identify which database the user is most likely referring to.
    
      Database names:
      ${databaseTitles
        .map((title, index) => `${index + 1}. ${title}`)
        .join("\n")}

      User query: "${query}"

      Return ONLY the number of the most relevant database (1-${
        databaseTitles.length
      }). If no database seems relevant, return 0.`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that matches user queries to database names. Return only the number of the most relevant database.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 10,
    });

    const selectedIndex = parseInt(
      response.choices[0].message.content?.trim() || "0"
    );

    if (
      selectedIndex === 0 ||
      isNaN(selectedIndex) ||
      selectedIndex > databaseTitles.length
    ) {
      return { database: null, confidence: 0 };
    }

    return {
      database: databases[selectedIndex - 1],
      confidence: 1, // Since we're using GPT, we can be more confident in the match
    };
  } catch (error) {
    console.error("Error finding database:", error);
    return { database: null, confidence: 0 };
  }
};

// Function to match field names using OpenAI
export const matchFieldName = async (input: string, fields: Array<any>) => {
  try {
    const prompt = `Given the following list of available fields and a user's input, identify which field the user is most likely referring to.
    
        Available fields:
        ${fields
          .map((field, index) => `${index + 1}. ${field.name} (${field.type})`)
          .join("\n")}

        User input: "${input}"

        Return ONLY the number of the most relevant field (1-${
          fields.length
        }). If no field seems relevant, return 0.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that matches user field inputs to available database fields. Return only the number of the most relevant field.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 10,
    });

    const selectedIndex = parseInt(
      response.choices[0].message.content?.trim() || "0"
    );

    if (
      selectedIndex === 0 ||
      isNaN(selectedIndex) ||
      selectedIndex > fields.length
    ) {
      return null;
    }

    return fields[selectedIndex - 1];
  } catch (error) {
    console.error("Error matching field name:", error);
    return null;
  }
};

// Function to match status input to available options using OpenAI
export const matchStatusOption = async (
  input: string,
  availableOptions: Array<any>
) => {
  if (availableOptions.length === 0) return null;

  try {
    const prompt = `Given the following list of available status options and a user's input, identify which status option the user is most likely referring to.
    
      Available status options:
      ${availableOptions.map((opt, index) => `${index + 1}. ${opt}`).join("\n")}

      User input: "${input}"

      Return ONLY the number of the most relevant status option (1-${
        availableOptions.length
      }). If no option seems relevant, return 0.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that matches user status inputs to available status options. Return only the number of the most relevant option.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 10,
    });

    const selectedIndex = parseInt(
      response.choices[0].message.content?.trim() || "0"
    );

    if (
      selectedIndex === 0 ||
      isNaN(selectedIndex) ||
      selectedIndex > availableOptions.length
    ) {
      return null;
    }

    return availableOptions[selectedIndex - 1];
  } catch (error) {
    console.error("Error matching status option:", error);
    return null;
  }
};

export const getFieldInfo = (properties: Record<string, any>) => {
  return Object.entries(properties).map(([key, prop]) => ({
    key,
    name: prop.name,
    type: prop.type,
  }));
};

// Function to parse natural language input
export const parseEntryInput = async (
  input: string,
  properties: Record<string, any>
) => {
  const entry: Record<string, any> = {};
  const fields = getFieldInfo(properties);

  // Split input into field-value pairs
  const pairs = input.split(",").map((pair) => pair.trim());

  for (const pair of pairs) {
    let fieldInput, valueInput;

    // Try both formats: "set X to Y" and "X: Y"
    if (pair.toLowerCase().startsWith("set ")) {
      const parts = pair
        .slice(4)
        .split(" to ")
        .map((part) => part.trim());
      if (parts.length !== 2) continue;
      [fieldInput, valueInput] = parts;
    } else {
      const parts = pair.split(":").map((part) => part.trim());
      if (parts.length !== 2) continue;
      [fieldInput, valueInput] = parts;
    }

    // Match field name
    const matchedField: any = await matchFieldName(fieldInput, fields);
    if (!matchedField) {
      console.log(`❌ Could not match field: "${fieldInput}"`);
      console.log("Available fields:");
      fields.forEach((field) => console.log(`- ${field.name} (${field.type})`));
      return null;
    }

    // Handle value based on field type
    switch (matchedField.type) {
      case "title":
        entry[matchedField.key] = {
          title: [{ text: { content: valueInput } }],
        };
        break;
      case "rich_text":
        entry[matchedField.key] = {
          rich_text: [{ text: { content: valueInput } }],
        };
        break;
      case "number":
        // Extract numeric value from input
        const numericValue = parseFloat(valueInput.replace(/[^0-9.]/g, ""));
        if (isNaN(numericValue)) {
          console.log(
            `❌ Invalid number format for field "${matchedField.name}": "${valueInput}"`
          );
          return null;
        }
        entry[matchedField.key] = {
          number: numericValue,
        };
        break;
      case "select":
        entry[matchedField.key] = {
          select: { name: valueInput },
        };
        break;
      case "multi_select":
        entry[matchedField.key] = {
          multi_select: valueInput
            .split(",")
            .map((name) => ({ name: name.trim() })),
        };
        break;
      case "date":
        // Try to parse the date in various formats
        const dateFormats = [
          "MM/DD/YYYY",
          "YYYY-MM-DD",
          "DD/MM/YYYY",
          "MM-DD-YYYY",
          "YYYY/MM/DD",
        ];
        let parsedDate = null;
        for (const format of dateFormats) {
          try {
            parsedDate = new Date(valueInput);
            if (!isNaN(parsedDate.getTime())) break;
          } catch (e) {
            continue;
          }
        }
        if (!parsedDate || isNaN(parsedDate.getTime())) {
          console.log(
            `❌ Invalid date format for field "${matchedField.name}": "${valueInput}"`
          );
          return null;
        }
        entry[matchedField.key] = {
          date: { start: parsedDate.toISOString().split("T")[0] },
        };
        break;
      case "checkbox":
        // Convert various "true" and "false" inputs to boolean
        const trueValues = [
          "true",
          "yes",
          "done",
          "completed",
          "finished",
          "not started",
          "in progress",
        ];
        const falseValues = ["false", "no", "not done", "pending", "todo"];
        const lowerValue = valueInput.toLowerCase();
        if (trueValues.includes(lowerValue)) {
          entry[matchedField.key] = { checkbox: true };
        } else if (falseValues.includes(lowerValue)) {
          entry[matchedField.key] = { checkbox: false };
        } else {
          console.log(
            `❌ Invalid checkbox value for field "${matchedField.name}": "${valueInput}"`
          );
          return null;
        }
        break;
      case "status":
        const statusOptions = properties[matchedField.key].status.options.map(
          (opt: any) => opt.name
        );
        const matchedStatus = await matchStatusOption(
          valueInput,
          statusOptions
        );
        if (!matchedStatus) {
          console.log(
            `❌ Invalid status option. Available options are: ${statusOptions.join(
              ", "
            )}`
          );
          return null;
        }
        entry[matchedField.key] = {
          status: { name: matchedStatus },
        };
        break;
      default:
        entry[matchedField.key] = {
          [matchedField.type]: valueInput,
        };
    }
  }

  // Verify all required fields are present
  const requiredFields = fields.filter((field) => field.type === "title");
  for (const field of requiredFields) {
    if (!entry[field.key]) {
      console.log(`❌ Missing required field: "${field.name}"`);
      return null;
    }
  }

  return entry;
};

export const addDatabaseEntryFunc = async (
  databaseId: string,
  entry: any,
  notion: Client
) => {
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: entry,
    });
    console.log("✅ Successfully added entry to database");
    return response;
  } catch (error: any) {
    console.error("❌ Error adding entry:", error.message);
    return null;
  }
};

export const findBestMatchingDatabase = async (
  databaseName: string,
  databases: Array<any>
) => {
  const databaseList = databases.map((db) => getDatabaseTitle(db)).join(", ");

  const prompt = `Given the following list of database names: ${databaseList}
  
    User is looking for: "${databaseName}"

    Please return the exact name of the database that best matches what the user is looking for. 
    Only return the exact name, nothing else.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
    });

    const matchedName = response.choices[0].message.content?.trim();
    console.log(`GPT matched name: "${matchedName}"`);

    // Try exact match first
    let selectedDatabase = databases.find(
      (db) => getDatabaseTitle(db) === matchedName
    );

    // If no exact match, try case-insensitive match
    if (!selectedDatabase) {
      selectedDatabase = databases.find(
        (db) =>
          getDatabaseTitle(db).toLowerCase() === matchedName?.toLowerCase()
      );
    }

    // If still no match, try partial match
    if (!selectedDatabase) {
      selectedDatabase = databases.find(
        (db) =>
          getDatabaseTitle(db)
            .toLowerCase()
            .includes(matchedName?.toLowerCase()) ||
          matchedName
            ?.toLowerCase()
            .includes(getDatabaseTitle(db).toLowerCase())
      );
    }

    if (!selectedDatabase) {
      console.log(
        "Available database titles:",
        databases.map((db) => getDatabaseTitle(db))
      );
    }

    return selectedDatabase;
  } catch (error) {
    console.error("Error finding matching database:", error);
    return null;
  }
};

export const generateSummary = async (
  databaseTitle: string,
  schema: any,
  sampleItems: any
) => {
  const prompt = `Please provide a summary of the Notion database "${databaseTitle}".

      Database Schema:
      ${JSON.stringify(schema, null, 2)}

      Sample Items (up to 5):
      ${JSON.stringify(sampleItems, null, 2)}

      Please provide a concise summary that includes:
      1. The purpose of this database
      2. The main fields and their types
      3. A brief description of the sample items
      4. Any notable patterns or observations

      Keep the response under 300 words.
    `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
  });

  return response.choices[0].message.content || "";
};

type Database = {
  properties: {
    [key: string]: { type: string };
  };
};

export const getDatabaseSchema = (database: Database) => {
  const schema: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(database.properties)) {
    schema[key] = value.type;
  }
  return schema;
};

// Function to get sample items from database
export const getSampleItems = async (
  databaseId: string,
  limit = 5,
  notion: Client
) => {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: limit,
    });
    return response.results;
  } catch (error) {
    console.error("Error getting sample items:", error);
    return [];
  }
};
