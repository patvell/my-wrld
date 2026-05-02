"use client";

import React from "react";
import { motion } from "framer-motion";
import { Map, History, Plus, Compass, Globe } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface PillMenuProps {
    activeTab: "home" | "history" | "settings" | "world";
    onTabChange: (tab: "home" | "history" | "settings" | "world") => void;
    onAddClick: () => void;
    primaryColor: string;
}

export default function PillMenu({ activeTab, onTabChange, onAddClick, primaryColor }: PillMenuProps) {
    const tabs = [
        { id: "world", icon: Globe, label: "World" },
        { id: "home", icon: Compass, label: "Journey" },
        { id: "history", icon: History, label: "History" },
    ] as const;

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
            <div className="glass-dark rounded-full p-2 flex items-center gap-1 shadow-2xl border-white/5">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as "home" | "history" | "world")}
                        className={cn(
                            "relative px-6 py-3 rounded-full transition-all duration-300 flex items-center gap-2",
                            activeTab === tab.id ? "text-white" : "text-white/40 hover:text-white/60"
                        )}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="active-tab"
                                className="absolute inset-0 bg-white/10 rounded-full"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}
                        <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                        <span className="text-[10px] font-bold tracking-widest uppercase">{tab.label}</span>
                    </button>
                ))}

                <div className="w-[1px] h-6 bg-white/10 mx-2" />

                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onAddClick}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg shadow-black/20 hover:brightness-110 transition-colors duration-[3000ms]"
                    style={{ backgroundColor: primaryColor }}
                >
                    <Plus size={24} />
                </motion.button>
            </div>
        </div>
    );
}
