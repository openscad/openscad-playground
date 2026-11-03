import { useEffect } from 'react';

/** Mirror state.view.embed on <html class="embed-mode"> so page-level CSS (e.g. hiding the GitHub ribbon) follows it live. */
export function useEmbedClass(embed: boolean | undefined) {
  useEffect(() => {
    document.documentElement.classList.toggle('embed-mode', !!embed);
  }, [embed]);
}
