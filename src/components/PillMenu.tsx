"use client";

import React from "react";
import { motion } from "framer-motion";
import { History, Plus, Compass, Globe } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface PillMenuProps {
    activeTab: "home" | "history" | "settings" | "world";
    onTabChange: (tab: "home" | "history" | "settings" | "world") => void;
    onAddClick: () => void;
    chromeColor: string;
}

export default function PillMenu({ activeTab, onTabChange, onAddClick, chromeColor }: PillMenuProps) {
    const tabs = [
        { id: "world", icon: Globe, label: "World" },
        { id: "home", icon: Compass, label: "Journey" },
        { id: "history", icon: History, label: "History" },
    ] as const;

    return (
        <div className="z-50">
            <div className="glass-dark rounded-full p-1.5 flex items-center gap-0.5 shadow-2xl border-white/5">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as "home" | "history" | "world")}
                        className={cn(
                            "relative px-3 py-2.5 rounded-full transition-all duration-300 flex items-center gap-1.5",
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
                        <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                        <span className="text-[9px] font-bold tracking-wider uppercase">{tab.label}</span>
                    </button>
                ))}

                <div className="w-[1px] h-5 bg-white/10 mx-1" />

                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onAddClick}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg shadow-black/20 hover:brightness-110 transition-colors duration-1000"
                    style={{ backgroundColor: chromeColor }}
                >
                    <Plus size={20} />
                </motion.button>
            </div>
        </div>
    );
}
