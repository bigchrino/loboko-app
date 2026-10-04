// Share one document lock across comments, chats and the media editor.
// Independent saved-overflow effects can restore "hidden" after the final
// overlay closes when they unmount in a different order from their mounts.
let locks = 0;
let restoreStyles: (() => void) | undefined;

export function lockPageScroll(): () => void {
  if (locks === 0) {
    const html = document.documentElement;
    const body = document.body;
    const htmlOverflow = html.style.overflow;
    const bodyOverflow = body.style.overflow;
    const paddingRight = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    const currentPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;

    restoreStyles = () => {
      html.style.overflow = htmlOverflow;
      body.style.overflow = bodyOverflow;
      body.style.paddingRight = paddingRight;
    };
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) {
      restoreStyles?.();
      restoreStyles = undefined;
    }
  };
}
