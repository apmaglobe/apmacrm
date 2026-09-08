"use client";
import {useEffect,useSyncExternalStore} from "react";
const eventName="apma-theme-changed";
function subscribe(listener:()=>void){window.addEventListener('storage',listener);window.addEventListener(eventName,listener);return ()=>{window.removeEventListener('storage',listener);window.removeEventListener(eventName,listener);};}
function snapshot(){try{return localStorage.getItem('apma-theme')==='dark';}catch{return document.documentElement.dataset.theme==='dark';}}
const serverSnapshot=()=>false;
export function useTheme(){const dark=useSyncExternalStore(subscribe,snapshot,serverSnapshot);return {dark,toggle:()=>{const theme=dark?'light':'dark';try{localStorage.setItem('apma-theme',theme);}catch{}document.documentElement.dataset.theme=theme;window.dispatchEvent(new Event(eventName));}};}
export function ThemeRoot(){const {dark}=useTheme();useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);return null;}
