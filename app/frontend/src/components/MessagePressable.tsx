import { useEffect, useRef, type HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  onMenu: (x: number, y: number) => void;
}

export default function MessagePressable({ disabled = false, onMenu, className = '', children, ...props }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const held = useRef(false);
  const menu = useRef(onMenu);
  menu.current = onMenu;
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };
  useEffect(() => cancel, [disabled]);
  return (
    <div {...props} className={`loboko-message-pressable ${className}`}
      onPointerDownCapture={(event) => {
        // Portals such as the fullscreen photo viewer belong to their own UI.
        if (!event.currentTarget.contains(event.target as Node)) return;
        cancel();
        held.current = false;
        if (disabled || event.button !== 0 || !event.isPrimary) return;
        const { clientX: x, clientY: y, pointerId: id } = event;
        origin.current = { x, y, id };
        timer.current = setTimeout(() => {
          timer.current = null;
          held.current = true;
          menu.current(x, y);
        }, 450);
      }}
      onPointerMoveCapture={(event) => {
        const start = origin.current;
        if (start && start.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel();
      }}
      onPointerUpCapture={cancel}
      onPointerCancelCapture={cancel}
      onPointerLeave={cancel}
      onClickCapture={(event) => {
        if (held.current && event.currentTarget.contains(event.target as Node)) {
          // Releasing a hold must not also open the image or start playback.
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onContextMenu={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        event.preventDefault();
        event.stopPropagation();
        cancel();
        if (!disabled && !held.current) {
          held.current = true;
          menu.current(event.clientX, event.clientY);
        }
      }}
    >{children}</div>
  );
}
