export const getCurrentMinutes = (): number => {
  const d = new Date();
  return 60 * (d.getHours()) + d.getMinutes();
};
export const getCurrentDay = (): number => (new Date()).getDate();
export const getCurrentMonth = (): number => (new Date()).getMonth() + 1;
export const getCurrentYear = (): number => (new Date()).getFullYear();
