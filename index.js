import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { google } from "googleapis";

import fs from "fs";

// Environment Variables (fallback)
let FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
let FB_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

// Helper to get fresh tokens
function getFreshTokens() {
  try {
    const configPath = "C:\\Users\\Asus\\.gemini\\config\\mcp_config.json";
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const env = config.mcpServers["social-media-mcp"]?.env;
      if (env) {
        if (env.FACEBOOK_PAGE_ID) FB_PAGE_ID = env.FACEBOOK_PAGE_ID;
        if (env.FACEBOOK_ACCESS_TOKEN) FB_ACCESS_TOKEN = env.FACEBOOK_ACCESS_TOKEN;
      }
    }
  } catch (e) {
    console.error("Failed to read config:", e);
  }
}

const server = new Server(
  {
    name: "social-media-mcp",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "post_to_facebook",
        description: "Post a status message to the configured Facebook Page.",
        inputSchema: {
          type: "object",
          properties: {
            message: { type: "string", description: "The text content of the post" },
          },
          required: ["message"],
        },
      },
      {
        name: "upload_to_youtube",
        description: "Upload a video to YouTube (requires OAuth token).",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Video title" },
            description: { type: "string", description: "Video description" },
            video_url: { type: "string", description: "URL or local path to video file" },
          },
          required: ["title", "description", "video_url"],
        },
      },
      {
        name: "post_to_tiktok",
        description: "Publish a video to TikTok.",
        inputSchema: {
          type: "object",
          properties: {
            video_url: { type: "string" },
            caption: { type: "string" },
          },
          required: ["video_url", "caption"],
        },
      },
      {
        name: "post_to_shopee",
        description: "Update Shopee shop feed/post.",
        inputSchema: {
          type: "object",
          properties: {
            content: { type: "string" },
            image_url: { type: "string" },
          },
          required: ["content"],
        },
      }
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // 1. Facebook
  if (name === "post_to_facebook") {
    getFreshTokens();
    if (!FB_PAGE_ID || !FB_ACCESS_TOKEN) {
      return { content: [{ type: "text", text: `[Simulation Mode] Successfully generated Facebook post!\nContent: ${args.message}\n(Note: To post to real Facebook, please add API keys to config)` }] };
    }
    try {
      const response = await axios.post(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`, {
        message: args.message,
        access_token: FB_ACCESS_TOKEN
      });
      return { content: [{ type: "text", text: `Successfully posted to Facebook! Post ID: ${response.data.id}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Facebook Error: ${error.response?.data?.error?.message || error.message}` }], isError: true };
    }
  }

  // 2. YouTube
  if (name === "upload_to_youtube") {
    if (!YT_ACCESS_TOKEN) return { content: [{ type: "text", text: "Error: YouTube OAuth Token missing in mcp_config.json" }], isError: true };
    
    // In a real scenario, this would use googleapis to stream the file.
    // We are simulating the API call structure here.
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: YT_ACCESS_TOKEN });
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      // Simulate successful request
      return { content: [{ type: "text", text: `[Simulated] Successfully scheduled YouTube video: ${args.title}` }] };
    } catch (error) {
       return { content: [{ type: "text", text: `YouTube Error: ${error.message}` }], isError: true };
    }
  }

  // 3. TikTok
  if (name === "post_to_tiktok") {
    if (!TIKTOK_ACCESS_TOKEN) return { content: [{ type: "text", text: "Error: TikTok Access Token missing in mcp_config.json" }], isError: true };
    return { content: [{ type: "text", text: `[Simulated] Successfully posted to TikTok with caption: ${args.caption}` }] };
  }

  // 4. Shopee
  if (name === "post_to_shopee") {
    if (!SHOPEE_SHOP_ID || !SHOPEE_ACCESS_TOKEN) return { content: [{ type: "text", text: "Error: Shopee keys missing in mcp_config.json" }], isError: true };
    return { content: [{ type: "text", text: `[Simulated] Successfully updated Shopee feed: ${args.content}` }] };
  }

  throw new Error(`Tool not found: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Multi-Platform Social Media MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
