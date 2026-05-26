export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center justify-center rounded-2xl border border-transparent bg-gradient-to-r from-sky-400 to-blue-500 px-6 py-3 text-sm font-black text-white transition-all duration-300 ease-in-out hover:from-sky-500 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-600/40 ${disabled && 'opacity-40 cursor-not-allowed'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
