export default {
  attributeDiagnosticsDefaultSeverity: [
    {
      severity: "error",
      patterns: ["className"],
    },
    {
      severity: "warning",
      patterns: [/^on[A-Z]/],
    },
  ],
  attributeDiagnostics: [
    "className",
    /^on[A-Z]/,
  ],
};
