#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerBlogTools } from "./tools/blog.js";
import { registerProductTools } from "./tools/products.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerReportTools } from "./tools/reports.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerPosTools } from "./tools/pos.js";
import { registerSteadfastTools } from "./tools/steadfast.js";
import { registerGa4Tools } from "./tools/ga4.js";
import { registerTestimonialTools } from "./tools/testimonials.js";
import { registerExpenseTools } from "./tools/expenses.js";
import { registerActivityTools } from "./tools/activity.js";
import { registerReviewTools } from "./tools/reviews.js";

const server = new McpServer({
  name: "sleep-sheet",
  version: "0.1.0",
});

registerBlogTools(server);
registerProductTools(server);
registerOrderTools(server);
registerCategoryTools(server);
registerCustomerTools(server);
registerReportTools(server);
registerAnalyticsTools(server);
registerPosTools(server);
registerSteadfastTools(server);
registerGa4Tools(server);
registerTestimonialTools(server);
registerExpenseTools(server);
registerActivityTools(server);
registerReviewTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
