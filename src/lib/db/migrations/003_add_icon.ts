export const migration003 = {
  id: 3,
  name: "003_add_icon",
  up: `
    ALTER TABLE local_habits ADD COLUMN icon TEXT;
  `,
};
