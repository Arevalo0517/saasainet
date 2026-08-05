import { initWidget, type WidgetHandle, type WidgetInitOptions } from './widget.js';

export type { WidgetHandle, WidgetInitOptions };
export { initWidget };
export const PLACEHOLDER = 'Widget embebible de chat AInet. Uso: PlatformWidget.init(publicWidgetId, { apiUrl }).';

export interface WidgetConfig {
  publicWidgetId: string;
  apiUrl: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  title?: string;
  welcomeMessage?: string;
}
