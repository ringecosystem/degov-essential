const pinoPrettyTransport = {
  target: "pino-pretty",
  options: {
    translateTime: "UTC:yyyy-mm-dd HH:MM:ss.l o",
    ignore: "pid,hostname",
    singleLine: true,
  },
};

export const DEFINED_LOGGER_RULE = {
  development: {
    level: "trace",
    transport: pinoPrettyTransport,
  },
  production: {
    level: "info",
    transport: pinoPrettyTransport,
  },
};
