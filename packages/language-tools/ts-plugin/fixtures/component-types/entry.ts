import Inferred from "./Inferred.slate";

Inferred.render({
  count: 1,
  tone: "primary",
});

Inferred({
  count: 1,
  tone: "secondary",
  children: "content",
});

Inferred.render({
  count: 1,
  tone: "primary",
  align: "end",
  "menu-class": undefined,
});
