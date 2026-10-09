export default function Segmented({ label, options, value, onChange, disabled = false }) {
	return (
		<div className="segmented" role="group" aria-label={label}>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					className={option.value === value ? "on" : ""}
					aria-pressed={option.value === value}
					disabled={disabled}
					onClick={() => onChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
