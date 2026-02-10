import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface ImageCropEditorProps {
  imageUrl: string;
  initialTop: number;
  initialLeft: number;
  initialWidth: number;
  initialHeight: number;
  onSave: (top: number, left: number, width: number, height: number) => void;
  onCancel: () => void;
}

const ImageCropEditor = ({
  imageUrl,
  initialTop,
  initialLeft,
  initialWidth,
  initialHeight,
  onSave,
  onCancel,
}: ImageCropEditorProps) => {
  const [cropTop, setCropTop] = useState(initialTop);
  const [cropHeight, setCropHeight] = useState(initialHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<"top" | "bottom" | null>(null);

  const cropBottom = cropTop + cropHeight;

  const handleTopChange = (value: number[]) => {
    const newTop = value[0];
    if (newTop < cropBottom - 0.02) {
      setCropTop(newTop);
      setCropHeight(cropBottom - newTop);
    }
  };

  const handleBottomChange = (value: number[]) => {
    const newBottom = value[0];
    if (newBottom > cropTop + 0.02) {
      setCropHeight(newBottom - cropTop);
    }
  };

  const handleMouseDown = useCallback((edge: "top" | "bottom") => {
    isDragging.current = edge;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      if (isDragging.current === "top" && ratio < cropBottom - 0.02) {
        setCropTop(ratio);
        setCropHeight(cropBottom - ratio);
      } else if (isDragging.current === "bottom" && ratio > cropTop + 0.02) {
        setCropHeight(ratio - cropTop);
      }
    },
    [cropTop, cropBottom]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = null;
  }, []);

  useEffect(() => {
    const up = () => { isDragging.current = null; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">تعديل إطار القص</Label>
          <div
            ref={containerRef}
            className="relative w-full border rounded-lg overflow-hidden cursor-crosshair select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <img src={imageUrl} alt="صفحة السؤال" className="w-full block" draggable={false} />
            {/* Dark overlay top */}
            <div
              className="absolute inset-x-0 top-0 bg-black/60 pointer-events-none"
              style={{ height: `${cropTop * 100}%` }}
            />
            {/* Dark overlay bottom */}
            <div
              className="absolute inset-x-0 bottom-0 bg-black/60 pointer-events-none"
              style={{ height: `${(1 - cropBottom) * 100}%` }}
            />
            {/* Crop frame */}
            <div
              className="absolute inset-x-0 border-2 border-dashed border-primary pointer-events-none"
              style={{
                top: `${cropTop * 100}%`,
                height: `${cropHeight * 100}%`,
              }}
            />
            {/* Top handle */}
            <div
              className="absolute inset-x-0 h-3 cursor-ns-resize flex items-center justify-center z-10"
              style={{ top: `calc(${cropTop * 100}% - 6px)` }}
              onMouseDown={() => handleMouseDown("top")}
            >
              <div className="w-12 h-1.5 rounded-full bg-primary" />
            </div>
            {/* Bottom handle */}
            <div
              className="absolute inset-x-0 h-3 cursor-ns-resize flex items-center justify-center z-10"
              style={{ top: `calc(${cropBottom * 100}% - 6px)` }}
              onMouseDown={() => handleMouseDown("bottom")}
            >
              <div className="w-12 h-1.5 rounded-full bg-primary" />
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm">الحد العلوي: {Math.round(cropTop * 100)}%</Label>
              <Slider
                value={[cropTop]}
                min={0}
                max={0.98}
                step={0.005}
                onValueChange={handleTopChange}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">الحد السفلي: {Math.round(cropBottom * 100)}%</Label>
              <Slider
                value={[cropBottom]}
                min={0.02}
                max={1}
                step={0.005}
                onValueChange={handleBottomChange}
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">معاينة النتيجة</Label>
          <div className="border rounded-lg overflow-hidden bg-muted">
            <div style={{ overflow: 'hidden' }}>
              <img
                src={imageUrl}
                alt="معاينة القص"
                draggable={false}
                style={{
                  width: '100%',
                  display: 'block',
                  clipPath: `inset(${cropTop * 100}% 0 ${(1 - cropBottom) * 100}% 0)`,
                  marginTop: `-${cropTop * 100}%`,
                  marginBottom: `-${(1 - cropBottom) * 100}%`,
                }}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            هذا ما ستراه الطالبة في الاختبار
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button onClick={() => onSave(cropTop, initialLeft, initialWidth, cropHeight)}>
          حفظ القص
        </Button>
      </div>
    </div>
  );
};

export default ImageCropEditor;
