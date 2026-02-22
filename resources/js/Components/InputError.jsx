export default function InputError({ message, className = '', ...props }) {
    return message ? (
        <p
            {...props}
            className={'text-sm text-rose-600 font-bold flex items-center gap-1.5 ' + className}
        >
            <span className="text-xs">⚠️</span> {message}
        </p>
    ) : null;
}
