export default {
  html: {
    attributeDiagnostics: [
      {
        pattern: "className",
        severity: "warning",
        message: "LSP className diagnostic."
      },
      {
        pattern: "htmlFor",
        severity: "error",
        message: "LSP htmlFor diagnostic."
      }
    ]
  }
};
