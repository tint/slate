import Card from "./Card.slate";

Card.render(
  { title: 123 },
  {
    header: ({ title, tail }: { title: string; tail: number }) => {
      title.toFixed();
      tail.toUpperCase();
    },
    footer: () => undefined,
  },
);
