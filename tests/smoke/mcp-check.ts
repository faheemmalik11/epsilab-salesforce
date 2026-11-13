import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const url = process.argv[2] ?? 'http://localhost:8080/mcp';
const client = new Client({ name: 'smoke', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
const result = await client.callTool({ name: 'health', arguments: {} });
await client.close();
console.log(JSON.stringify(result.structuredContent));
