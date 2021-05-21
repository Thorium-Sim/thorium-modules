import type {ComponentDefinition as ECSComponent, System as ECSSystem} from '@thorium-sim/ecs'
export interface CardProps {}
export interface CoreProps {}
export interface ConfigProps {}
export interface NetSendInput {
  [params: string]: unknown;
}
export interface NetSendResult {
  [params: string]: unknown;
}
export interface PluginAPI {
  registerCard(name: string, component: React.ComponentType<CardProps>): void;
  registerCore(name: string, component: React.ComponentType<CoreProps>): void;
  registerEvent(
    inputType: string,
    eventHandler: (command: NetSendInput) => NetSendResult
  ): void;
  registerComponent(name: string, component: ECSComponent): void;
  registerSystem(name: string, system: ECSSystem): void;
  registerConfigRoute(
    route: string,
    component: React.ComponentType<ConfigProps>
  ): void;
}
export interface ThoriumAPI {
  plugin: PluginAPI;
  netSend(command: NetSendInput): NetSendResult;
}

declare global {
  const thorium: ThoriumAPI;
}
export default {};
