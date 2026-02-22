export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'w-5 h-5 rounded-lg border-slate-300 text-indigo-600 shadow-sm focus:ring-indigo-500 focus:ring-offset-1 transition-all duration-200 cursor-pointer ' +
                className
            }
        />
    );
}
