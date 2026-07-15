import React from 'react';
import { Upload, Trash2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const ImageUploader = ({
    imageUrl,
    onImageChange,
    onMagicClick,
    uploading = false,
    setUploading,
    showMagicButton = false
}) => {

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('הקובץ גדול מדי. מקסימום 5MB');
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('יש לבחור קובץ תמונה בלבד');
            return;
        }

        setUploading?.(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('menu-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('menu-images')
                .getPublicUrl(fileName);

            onImageChange(publicUrl);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('שגיאה בהעלאת תמונה: ' + error.message);
        } finally {
            setUploading?.(false);
        }
    };

    const deleteImage = () => {
        onImageChange('');
    };

    return (
        <div className="flex items-start gap-4">
            {/* Image Preview */}
            <div className="w-28 h-28 bg-gray-50 rounded-2xl border-2 border-gray-100 overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                ) : (
                    <ImageIcon size={32} className="text-gray-300" />
                )}
                {uploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {/* Buttons Stack */}
            <div className="flex flex-col gap-2 flex-1">
                <label className="flex items-center gap-2 px-3 py-2 bg-white text-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 hover:text-blue-600 transition shadow-sm border border-gray-200 text-sm font-bold justify-center active:scale-95">
                    <Upload size={16} />
                    <span>{uploading ? 'מעלה...' : 'העלאה'}</span>
                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                    />
                </label>

                {showMagicButton && (
                    <button
                        type="button"
                        onClick={onMagicClick}
                        className="flex items-center gap-2 px-3 py-2 bg-white text-purple-600 rounded-xl hover:bg-purple-50 transition shadow-sm border border-gray-200 text-sm font-bold justify-center active:scale-95"
                    >
                        <Sparkles size={16} />
                        <span>AI Magic</span>
                    </button>
                )}

                {imageUrl && (
                    <button
                        type="button"
                        onClick={deleteImage}
                        className="flex items-center gap-2 px-3 py-2 bg-white text-red-500 rounded-xl hover:bg-red-50 transition shadow-sm border border-gray-200 text-sm font-bold justify-center active:scale-95"
                    >
                        <Trash2 size={16} />
                        <span>מחיקה</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default React.memo(ImageUploader);
