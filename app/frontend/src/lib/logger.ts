type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  context?: string;
  error?: unknown;
  data?: unknown;
}

const isDev = import.meta.env.DEV;

function print(level: LogLevel, message: string, payload?: LogPayload) {
  const prefix = `[LOBOKO:${level.toUpperCase()}]`;

  if (level === 'error') {
    console.error(prefix, message, payload || '');
  } else if (level === 'warn') {
    console.warn(prefix, message, payload || '');
  } else {
    console.log(prefix, message, payload || '');
  }
}

export const logger = {
  info(message: string, payload?: LogPayload) {
    if (isDev) {
      print('info', message, payload);
    }
  },

  warn(message: string, payload?: LogPayload) {
    print('warn', message, payload);
  },

  error(message: string, payload?: LogPayload) {
    print('error', message, payload);
  },
};
