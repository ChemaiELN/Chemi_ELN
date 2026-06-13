declare module '*.less' {
  const styles: Record<string, string>
  export default styles
}

declare module '*.svg' {
  const src: string
  export default src
}
