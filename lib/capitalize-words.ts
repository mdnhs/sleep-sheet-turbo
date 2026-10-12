// Upper-cases the first English letter of every word, like CSS
// `text-transform: capitalize`, so what's saved matches what the
// `capitalize` inputs showed. The rest of each word is left as typed
// ("mcDonald" -> "McDonald"), and non-Latin text such as Bangla is untouched.
//
// A word starts at the beginning, after whitespace, or after - / ( , .
// so "house 12, road-5/a" -> "House 12, Road-5/A".
export function capitalizeWords(value: string): string {
  return value.replace(/(^|[\s\-/(,.])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}
