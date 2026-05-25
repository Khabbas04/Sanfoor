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
                `inline-flex items-center justify-center rounded-2xl border border-transparent bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-black text-white transition-all duration-300 ease-in-out hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 active:scale-95 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-600/40 ${disabled && 'opacity-40 cursor-not-allowed'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
