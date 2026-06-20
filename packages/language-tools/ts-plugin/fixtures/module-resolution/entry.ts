import Card from "./Card.slate";

Card.render(
  { title: 123 },
  {
    header: ({ title, tail }) => {
      title.toFixed();
      tail.toUpperCase();
    },
    footer: () => undefined,
  },
);
