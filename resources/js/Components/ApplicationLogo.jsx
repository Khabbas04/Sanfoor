import React from 'react';

export default function ApplicationLogo(props) {
    return (
        <div {...props} className={`flex items-center gap-2 font-black tracking-tighter ${props.className} font-cairo`}>
            {/* الأيقونة */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg shadow-indigo-200 text-3xl">
                🎓
            </div>
            {/* النص */}
            <div className="text-3xl" dir="ltr">
                <span className="text-slate-800">San</span>
                <span className="text-indigo-600">foor</span>
            </div>
        </div>
    );
}