/**
 * Contrato mínimo de log usado pelas camadas de negócio (DIP).
 * O logger Winston de lib/logger.ts já satisfaz esta interface, sem adaptador.
 */
export interface ILogger {
  info(message: string): unknown;
  warn(message: string): unknown;
  error(message: string): unknown;
}
