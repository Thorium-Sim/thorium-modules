export type Component = Record<string, unknown>;
export type ComponentDefinition = {
  id: string;
  getDefaults(): Component;
};
export type ComponentId = string;
