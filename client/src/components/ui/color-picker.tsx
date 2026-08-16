import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { cn } from '@/lib/utils';
import { Pipette } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  presetColors?: string[];
}

export default function ColorPicker({
  value,
  onChange,
  className,
  presetColors = [],
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleChange = useCallback(
    (color: string) => {
      onChange(color);
    },
    [onChange]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Position popover near the trigger button
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverStyle({
        position: 'fixed',
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        zIndex: 9999,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className={cn('relative inline-flex items-center gap-2', className)}>
      {/* Color swatch button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="w-9 h-9 rounded-lg border border-border cursor-pointer transition-all hover:ring-2 hover:ring-ring/50 focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
        style={{ backgroundColor: value }}
        aria-label="Pick a color"
      />

      {/* Popover via portal to avoid overflow clipping */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="p-3 bg-popover border border-border rounded-xl shadow-2xl"
          >
            <HexColorPicker color={value} onChange={handleChange} />

            {/* Hex input */}
            <div className="mt-3 flex items-center gap-2">
              <Pipette className="size-3.5 text-muted-foreground shrink-0" />
              <HexColorInput
                color={value}
                onChange={handleChange}
                className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                prefixed
              />
            </div>

            {/* Preset colors */}
            {presetColors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onChange(color)}
                    className={cn(
                      'w-5 h-5 rounded-md border transition-all hover:scale-110',
                      value === color ? 'border-foreground ring-1 ring-foreground' : 'border-border'
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
