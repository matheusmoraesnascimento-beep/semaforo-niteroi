export type ServiceErrorKind = 'network' | 'http' | 'format' | 'no-route';

export class ServiceError extends Error {
  kind: ServiceErrorKind;

  constructor(kind: ServiceErrorKind, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.kind = kind;
  }
}

/** Texto para o usuário, a partir de qualquer erro dos serviços de busca/rota. */
export function errorMessage(e: unknown): string {
  if (e instanceof ServiceError) {
    switch (e.kind) {
      case 'network':
        return 'Sem conexão. Verifique a internet.';
      case 'no-route':
        return 'Não encontrei rota para esse destino.';
      default:
        return 'O serviço respondeu com erro. Tente de novo.';
    }
  }
  return 'Erro inesperado.';
}
