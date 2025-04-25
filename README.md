# Lisa - Your AI Co-Founder

Built by Muhammad Hashim, Aazar Jan and Shahbaz Abdullah Magsi

Lisa is an open-source voice assistant designed for founders, operators, and visionaries who move at the speed of life. Built to integrate seamlessly with your existing tools, Lisa acts as your co-founder, handling tasks from email drafting to meeting scheduling with simple voice commands. No more app-switching or tab-juggling—just say it, and Lisa gets it done.

> Demo available at: https://beta.ourlisa.com

![LISA About](https://beta.ourlisa.com/assets/about-one-Bp8g_-Rs.png)

## Features

- **Connect Everything**: Syncs with Gmail, Google Calendar, Outlook, Outlook Calendar, Notion, Slack, GitHub, and bank accounts via Plaid. LISA centralizes your tools in one brain, eliminating the need to hunt for links or switch tabs.
- **Voice-Powered Execution**: Draft investor updates, manage to-dos, schedule meetings, or find events with natural voice commands. Your voice is the command line.
- **Daily Briefings**: Start each day with a personalized, no-noise summary of your inbox, meetings, updates, and relevant news.
- **Privacy First**: Engineered for trust. Your data is encrypted, secure, and never tracked. LISA works for you, not on you.
- **Built on Eleven Labs**: Leverages cutting-edge voice technology for natural, responsive interactions.

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 16+
- Accounts/API keys for:
  - Gmail/Google Calendar
  - Outlook/Outlook Calendar
  - Notion
  - Slack
  - GitHub
  - Plaid
  - Eleven Labs (for voice functionality)

### Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/ourlisaai/lisa.git
   cd lisa
   ```

2. **Install Dependencies**:

   ```bash
   pip install -r requirements.txt
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file in the root directory and add your API keys:

   ```
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   OUTLOOK_CLIENT_ID=your_outlook_client_id
   OUTLOOK_CLIENT_SECRET=your_outlook_client_secret
   NOTION_API_KEY=your_notion_api_key
   SLACK_BOT_TOKEN=your_slack_bot_token
   GITHUB_TOKEN=your_github_token
   PLAID_CLIENT_ID=your_plaid_client_id
   PLAID_SECRET=your_plaid_secret
   ELEVEN_LABS_API_KEY=your_eleven_labs_api_key
   ```

4. **Access Lisa**:
   Lisa runs locally and listens for voice commands. Configure your microphone and test with a simple command like, "Lisa, schedule a meeting for tomorrow at 10 AM."

## Usage

### Basic Commands

- **Email**: "Lisa, draft an email to [contact] about [topic]."
- **Calendar**: "Lisa, schedule a call with [name] next Tuesday at 3 PM."
- **Notion**: "Lisa, add a task to my Notion project for [task]."
- **Slack**: "Lisa, send a message to [channel] about [update]."
- **GitHub**: "Lisa, check the status of my pull requests."
- **Daily Briefing**: "Lisa, what's on my plate today?"

### Customization

- Modify `config.yaml` to tweak integrations or add new ones.

## License

Lisa is licensed under the MIT License. See [LICENSE](LICENSE) for more information.

## Community

- Follow us on X: [@ourlisaai](https://x.com/ourlisaai).
- Report issues or suggest features on [GitHub Issues](https://github.com/ourlisaai/lisa/issues).

## Roadmap

- Add support for additional integrations (e.g., Trello, Asana).
- Enhance natural language understanding for complex commands.
- Introduce web-based UI for configuration and monitoring.

Lisa is open source and built for those who execute. Join us in shaping the future of productivity.
