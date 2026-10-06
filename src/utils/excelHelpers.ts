export const excelLetterToNum = (letter: string): number => {
  let n = 0
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

export const excelNumToLetter = (n: number): string => {
  let s = ''
  while (n > 0) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

export const letterRange = (from: string, to: string): string[] => {
  const a = excelLetterToNum(from)
  const b = excelLetterToNum(to)
  const out: string[] = []
  for (let i = a; i <= b; i++) out.push(excelNumToLetter(i))
  return out
}

export const stripHtml = (s: string): string =>
  (s ?? '').replace(/<br\s*\/?>/gi, '').trim()

export const isValidCell = (v: unknown): boolean => {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return false
  if (['blank', 'n/a', 'na', 'nil', 'none', '-', '--', 'nan'].includes(s)) return false
  if (s.startsWith('submitform')) return false
  return true
}

export const extractBracketContent = (text: string): string => {
  if (!text) return ''
  const m = text.match(/\[(.*?)\]/)
  return m ? m[1] : ''
}

export const removeBrackets = (text: string): string => {
  if (!text) return ''
  return text.replace(/\s*\[.*?\]\s*/g, '').trim()
}

export const splitAnswers = (answer: string): string[] => {
  if (!answer) return ['']
  const s = String(answer).trim()
  if (s.includes(',')) return s.split(',').map((x) => x.trim()).filter((x) => x)
  return [s]
}

export const EXCEL_HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: '5B3E8E' } },
  alignment: { wrapText: true, vertical: 'center', horizontal: 'center' },
  border: {
    top:    { style: 'thin', color: { rgb: 'FFFFFF' } },
    bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
    left:   { style: 'thin', color: { rgb: 'FFFFFF' } },
    right:  { style: 'thin', color: { rgb: 'FFFFFF' } },
  },
}
