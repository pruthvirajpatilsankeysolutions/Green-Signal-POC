import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

const MAX_PHOTOS = 10;

export default function PhotoPicker({ files, onChange }) {
	const input = useRef(null);
	const [previews, setPreviews] = useState([]);

	useEffect(() => {
		const nextPreviews = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
		setPreviews(nextPreviews);
		return () => nextPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
	}, [files]);

	const addFiles = (event) => {
		const selected = Array.from(event.target.files || []);
		onChange([...files, ...selected].slice(0, MAX_PHOTOS));
		event.target.value = "";
	};

	const removeFile = (index) => onChange(files.filter((_, fileIndex) => fileIndex !== index));

	return (
		<div className="picker">
			{previews.map(({ file, url }, index) => (
				<figure className="thumb" key={`${file.name}-${file.lastModified}-${index}`}>
					<img src={url} alt={file.name} />
					{index === 0 && <figcaption>Cover</figcaption>}
					<button
						className="thumb-remove"
						type="button"
						aria-label={`Remove ${file.name || `photo ${index + 1}`}`}
						onClick={() => removeFile(index)}
					>
						<X size={14} aria-hidden="true" />
					</button>
				</figure>
			))}
			{files.length < MAX_PHOTOS && (
				<button className="thumb add" type="button" onClick={() => input.current?.click()}>
					<ImagePlus size={20} aria-hidden="true" />
					<span>Add photos</span>
					<input
						ref={input}
						type="file"
						accept="image/*"
						multiple
						hidden
						onChange={addFiles}
					/>
				</button>
			)}
		</div>
	);
}
