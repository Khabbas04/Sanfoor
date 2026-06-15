import React, { useEffect, useRef } from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { motion } from 'framer-motion';

export default function WelcomeExperimental({ auth }) {
    // Custom font configuration for Editorial Neo-Minimalism
    const serifClass = "font-serif tracking-tight";
    const sansClass = "font-sans tracking-normal";

    const fadeUp = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
    };

    return (
        <MainLayout>
            <Head title="سنفور | Experimental UI" />

            <div className="bg-white min-h-screen text-slate-900 overflow-hidden" dir="rtl">
                
                {/* 1. Hero Section - Asymmetric Canvas */}
                <section className="relative pt-32 pb-20 px-6 sm:px-12 lg:px-24">
                    {/* Subtle aesthetic accent */}
                    <div className="absolute top-0 right-0 w-1/3 h-[600px] bg-gradient-to-b from-teal-50/50 to-transparent opacity-80 pointer-events-none" />
                    
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                            
                            {/* Left Content (Text) */}
                            <motion.div 
                                initial="hidden" animate="visible" variants={fadeUp}
                                className="lg:col-span-7 z-10"
                            >
                                <h1 className={`${serifClass} text-5xl sm:text-7xl lg:text-[5.5rem] leading-[1.1] text-[#0A1128] font-black mb-8`}>
                                    دليلك الموثوق <br />
                                    نحو <i className="text-[#1D4ED8]">التفوق الأكاديمي.</i>
                                </h1>
                                <p className={`${sansClass} text-lg sm:text-xl text-slate-600 max-w-xl leading-relaxed mb-10 font-medium`}>
                                    نظام جامعي ذكي، مصمم بلمسة هندسية دقيقة لتنظيم مسارك، تتبع تقدمك، وإدارة مواردك الأكاديمية بوضوح تام وشفافية مطلقة.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-5">
                                    {auth.user ? (
                                        <Link href={route('tree.index')} className={`${sansClass} inline-flex items-center justify-center px-10 py-4 bg-[#0A1128] text-white text-base font-bold rounded-none hover:bg-[#1D4ED8] hover:text-white transition-colors duration-500 ease-out border border-[#0A1128]`}>
                                            دخول المنصة الأكاديمية
                                        </Link>
                                    ) : (
                                        <>
                                            <Link href={route('login')} className={`${sansClass} inline-flex items-center justify-center px-10 py-4 bg-[#0A1128] text-white text-base font-bold rounded-none hover:bg-[#1D4ED8] transition-colors duration-500 ease-out`}>
                                                بدء الاستخدام
                                            </Link>
                                            <a href="#features" className={`${sansClass} inline-flex items-center justify-center px-10 py-4 bg-white text-[#0A1128] text-base font-bold rounded-none border border-slate-300 hover:border-teal-600 hover:text-teal-700 transition-colors duration-500 ease-out`}>
                                                اكتشف الهيكلية
                                            </a>
                                        </>
                                    )}
                                </div>
                            </motion.div>

                            {/* Right Content (Abstract UI Representation) */}
                            <motion.div 
                                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                className="lg:col-span-5 relative"
                            >
                                <div className="w-full aspect-[4/5] bg-slate-50 border border-slate-200 p-8 flex flex-col relative shadow-[20px_20px_0px_0px_rgba(10,17,40,0.03)]">
                                    {/* Thin lines for structural look */}
                                    <div className="absolute top-0 bottom-0 left-8 w-[1px] bg-slate-200" />
                                    <div className="absolute top-8 left-0 right-0 h-[1px] bg-slate-200" />
                                    
                                    <div className="relative z-10 pt-8 pl-6 h-full flex flex-col">
                                        <div className="w-16 h-16 bg-[#1D4ED8] rounded-full mb-12 flex items-center justify-center">
                                            <span className="text-white text-2xl font-serif italic">S</span>
                                        </div>
                                        <div className="space-y-6 mt-auto">
                                            <div className="h-[1px] w-full bg-slate-300" />
                                            <div className="flex justify-between items-center">
                                                <span className={`${serifClass} text-slate-800 text-xl font-bold`}>الرؤية الأكاديمية</span>
                                                <span className="text-teal-600">01</span>
                                            </div>
                                            <div className="h-[1px] w-full bg-slate-300" />
                                            <div className="flex justify-between items-center opacity-50">
                                                <span className={`${serifClass} text-slate-800 text-xl font-bold`}>النظام المالي</span>
                                                <span className="text-slate-500">02</span>
                                            </div>
                                            <div className="h-[1px] w-full bg-slate-300" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                            
                        </div>
                    </div>
                </section>

                {/* 2. Feature Section - Thin Lines & Open Canvas */}
                <section id="features" className="py-24 px-6 sm:px-12 lg:px-24 border-t border-slate-200">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
                            <h2 className={`${serifClass} text-4xl sm:text-5xl lg:text-6xl text-[#0A1128] font-bold leading-tight max-w-2xl`}>
                                هيكلية مصممة <br /> 
                                <span className="text-teal-600 italic">للوضوح والإنجاز.</span>
                            </h2>
                            <p className={`${sansClass} text-slate-500 max-w-sm font-medium text-lg leading-relaxed`}>
                                تخلصنا من التعقيد لصالح واجهة وظيفية نقية تركز على ما يهمك فقط كطالب جامعي.
                            </p>
                        </div>

                        {/* Asymmetric Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-y-12 md:gap-x-12 border-t border-slate-200 pt-12">
                            
                            {/* Feature 1 */}
                            <div className="md:col-span-4 group cursor-default">
                                <span className={`${sansClass} text-teal-600 font-bold mb-4 block text-sm tracking-widest`}>MODULE 01</span>
                                <h3 className={`${serifClass} text-2xl text-[#0A1128] font-bold mb-4 group-hover:text-[#1D4ED8] transition-colors duration-300`}>التتبع الأكاديمي الدقيق</h3>
                                <p className={`${sansClass} text-slate-600 leading-relaxed`}>
                                    خريطة مرئية متكاملة لموادك الجامعية. تتبع ما تم إنجازه، واكتشف المتطلبات اللاحقة من خلال شجرة مترابطة بخطوط هندسية واضحة.
                                </p>
                            </div>

                            {/* Feature 2 - Spans more columns for asymmetry */}
                            <div className="md:col-span-5 md:pl-12 border-t md:border-t-0 md:border-r border-slate-200 pt-12 md:pt-0 group cursor-default">
                                <span className={`${sansClass} text-[#1D4ED8] font-bold mb-4 block text-sm tracking-widest`}>MODULE 02</span>
                                <h3 className={`${serifClass} text-3xl text-[#0A1128] font-bold mb-4 group-hover:text-teal-600 transition-colors duration-300`}>المستشار الذكي (AI)</h3>
                                <p className={`${sansClass} text-slate-600 leading-relaxed text-lg`}>
                                    محرك ذكاء اصطناعي حصري يقوم بقراءة هيكلية تخصصك وتقديم اقتراحات تسجيل احترافية لتحسين معدلك التراكمي بناءً على بيانات فعلية وتجارب سابقة، مقدماً بأسلوب محادثة رسمي ومركّز.
                                </p>
                            </div>

                            {/* Feature 3 */}
                            <div className="md:col-span-3 border-t md:border-t-0 border-slate-200 pt-12 md:pt-0 group cursor-default">
                                <span className={`${sansClass} text-slate-400 font-bold mb-4 block text-sm tracking-widest`}>MODULE 03</span>
                                <h3 className={`${serifClass} text-2xl text-[#0A1128] font-bold mb-4`}>دليل الحرم الجامعي</h3>
                                <p className={`${sansClass} text-slate-600 leading-relaxed`}>
                                    دليل مكاني مصمم على شكل فهرس تحريري أنيق لمعرفة القاعات، الكليات، والمرافق الجامعية دون عناء البحث العشوائي.
                                </p>
                            </div>

                        </div>
                    </div>
                </section>

                {/* 3. Footer / CTA - Minimalist */}
                <section className="bg-[#0A1128] text-white py-32 px-6 sm:px-12 lg:px-24">
                    <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
                        <h2 className={`${serifClass} text-4xl sm:text-6xl font-black mb-8 leading-tight`}>
                            ارتقِ بتجربتك الجامعية.
                        </h2>
                        <p className={`${sansClass} text-slate-400 text-xl mb-12 max-w-2xl font-medium`}>
                            انضم إلى النظام الأكاديمي المصمم لجيل يقدر الكفاءة والجماليات الوظيفية.
                        </p>
                        <Link href={route('login')} className={`${sansClass} inline-flex items-center justify-center px-12 py-5 bg-white text-[#0A1128] text-lg font-bold rounded-none hover:bg-teal-50 hover:text-teal-700 transition-all duration-500 ease-out`}>
                            دخول النظام
                        </Link>
                    </div>
                </section>

            </div>
        </MainLayout>
    );
}
