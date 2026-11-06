'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DonorPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [formData, setFormData] = useState({
    lat: '',
    lng: '',
    donor_token: '',
  });
  const router = useRouter();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) return alert('Please select an image');
    if (!formData.lat || !formData.lng || !formData.donor_token) return alert('Fill all fields');

    const form = new FormData();
    form.append('image', imageFile);
    form.append('lat', formData.lat);
    form.append('lng', formData.lng);
    form.append('donor_token', formData.donor_token);

    try {
      const res = await fetch('/api/batches/scan', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      router.push(`/donor/preview/${data.draft_id}`);
    } catch (err) {
      alert('Upload failed');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Scan Surplus Food</h1>
      <p className="text-lg mb-4">Capture a photo of leftover cooked food and get a pickup alert in 30 seconds.</p>

      <div className="w-full max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Photo of food
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="w-full"
            onChange={handleImageChange}
          />
          {imageFile && (
            <div className="mt-2">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-48 object-cover rounded"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Your latitude (e.g., 37.7749)"
            value={formData.lat}
            onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Your longitude (e.g., -122.4194)"
            value={formData.lng}
            onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Donor token (unique ID)"
            value={formData.donor_token}
            onChange={(e) => setFormData({ ...formData, donor_token: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <button
            type="submit"
            onClick={handleSubmit}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Scan & Confirm
          </button>
        </div>
      </div>
    </main>
  );
}