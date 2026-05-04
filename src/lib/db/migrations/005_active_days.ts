export const migration005 = {
  id: 5,
  name: "005_active_days",
  raw: false,
  up: `
    ALTER TABLE local_habits
    ADD COLUMN active_days TEXT NOT NULL DEFAULT '[1,2,3,4,5,6,7]';
  `,
};
