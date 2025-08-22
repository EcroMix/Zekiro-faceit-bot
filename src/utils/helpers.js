module.exports = {
  calculateZF: (kills, deaths) => {
    if (deaths === 0) return kills * 10;
    return Math.round(kills / deaths * 10);
  },

  getLevel: (zf) => {
    if (zf < 200) return 1;
    if (zf < 400) return 2;
    if (zf < 600) return 3;
    if (zf < 800) return 4;
    if (zf < 1000) return 5;
    if (zf < 1200) return 6;
    if (zf < 1400) return 7;
    if (zf < 1700) return 8;
    if (zf < 2000) return 9;
    return 10;
  },
};