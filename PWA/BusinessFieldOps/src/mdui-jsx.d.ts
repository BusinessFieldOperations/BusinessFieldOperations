import 'preact';

declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      // Quick, permissive version: every <mdui-*> tag is allowed.
      [tag: `mdui-${string}`]: JSX.HTMLAttributes<HTMLElement> &
        Record<string, unknown>;
    }
  }
}
