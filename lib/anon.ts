export function generateAnonName() {
    const num = Math.floor(1000 + Math.random() * 9000)
    return `익명${num}`
  }
  