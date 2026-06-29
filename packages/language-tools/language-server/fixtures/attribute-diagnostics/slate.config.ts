export default {
  html: {
    attributeDiagnosticsDefaultSeverity: {
      error: ["htmlFor", "className"],
      warning: [/^on[A-Z]/],
    },
    attributeDiagnostics: [
      "className",
      "htmlFor",
      /^on[A-Z]/,
    ]
  }
};
