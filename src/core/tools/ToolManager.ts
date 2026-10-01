import { Tool, ToolDefinition, ToolResult, ToolRiskLevel } from '@shared/types';

export class ToolManager {
  private tools: Map<string, Tool> = new Map();

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool not found: ${name}` };
    }
    try {
      const result = await tool.execute(args);
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}