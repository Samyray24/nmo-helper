import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import cn from 'classnames';
import './styles.scss';
import {AI_MODELS} from '../../../../utils/constants';
import type {IAiModel} from '../../../../types';
import {useActiveTheme} from '../../../../utils/theme';
import {IconChevronDown, IconStar} from '../../../icons';

interface IModelDropdownProps {
	readonly model: string;
	readonly setModel: (v: string) => void;
	readonly disabled?: boolean;
}

interface IPos {
	readonly left: number;
	readonly top?: number;
	readonly bottom?: number;
	readonly width: number;
	readonly maxHeight: number;
}

const ZERO: IPos = {left: 0, top: 0, width: 0, maxHeight: 240};

const ModelDropdown: React.FC<IModelDropdownProps> = ({model, setModel, disabled}) => {
	const theme = useActiveTheme();
	const [open, setOpen] = useState<boolean>(false);
	const [pos, setPos] = useState<IPos>(ZERO);
	const [search, setSearch] = useState('');

	const wrapRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const current = AI_MODELS.find(m => m.id === model);
	const query = search.trim().toLocaleLowerCase('ru');
	const filteredModels = query
		? AI_MODELS.filter(m => `${m.name} ${m.id} ${m.tier}`.toLocaleLowerCase('ru').includes(query))
		: AI_MODELS;

	const recalc = () => {
		if (!wrapRef.current) return;
		const rect = wrapRef.current.getBoundingClientRect();
		const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
		const spaceBelow = viewportHeight - rect.bottom - 12;
		const spaceAbove = rect.top - 12;
		if (spaceBelow < 200 && spaceAbove > spaceBelow) {
			setPos({
				left: rect.left,
				bottom: viewportHeight - rect.top + 4,
				width: rect.width,
				maxHeight: Math.min(280, Math.max(120, spaceAbove)),
			});
		} else {
			setPos({
				left: rect.left,
				top: rect.bottom + 4,
				width: rect.width,
				maxHeight: Math.min(280, Math.max(120, spaceBelow)),
			});
		}
	};

	const toggle = () => {
		if (disabled) return;
		if (!open) {
			recalc();
			setSearch('');
		}
		setOpen(o => !o);
	};

	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent) => {
			const t = e.target as Node;
			if (wrapRef.current?.contains(t)) return;
			if (listRef.current?.contains(t)) return;
			setOpen(false);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setOpen(false);
				buttonRef.current?.focus();
			}
		};
		const onScroll = (e: Event) => {
			if (listRef.current?.contains(e.target as Node)) return;
			recalc();
		};
		// откладываем подписку, чтобы тот же click, который открыл список, не закрыл его
		const id = setTimeout(() => document.addEventListener('mousedown', close), 0);
		document.addEventListener('keydown', onKeyDown);
		window.addEventListener('resize', recalc);
		window.addEventListener('scroll', onScroll, true);
		return () => {
			clearTimeout(id);
			document.removeEventListener('mousedown', close);
			document.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('resize', recalc);
			window.removeEventListener('scroll', onScroll, true);
		};
	}, [open]);

	useEffect(() => {
		if (disabled) setOpen(false);
	}, [disabled]);

	const handleSelect = (m: IAiModel) => {
		setModel(m.id);
		setOpen(false);
		buttonRef.current?.focus();
	};

	const list = (
		<div
			ref={listRef}
			data-nmo-portal=""
			data-nmo-theme={theme}
			className="nmo-md-list nmo-fade-up"
			style={{
				left: pos.left,
				top: pos.top,
				bottom: pos.bottom,
				width: pos.width,
				maxHeight: pos.maxHeight,
			}}>
			<div className="nmo-md-search">
				<input
					className="nmo-input nmo-md-search-input"
					type="search"
					aria-label="Поиск модели"
					placeholder="Быстрый фильтр моделей…"
					value={search}
					onChange={event => setSearch(event.target.value)}/>
			</div>
			<div className="nmo-md-options" role="listbox" aria-label="Модели ProxyAPI">
				{filteredModels.map(m => (
					<button key={m.id} type="button"
						role="option"
						aria-selected={m.id === model}
						className={cn('nmo-md-item', {selected: m.id === model})}
						onClick={() => handleSelect(m)}>
						<span className="nmo-md-item-name">
							<span>{m.name}</span>
							{m.tag === 'rec' && <IconStar size={9} className="nmo-md-rec"/>}
							{m.tag === 'pricey' && <span className="nmo-md-pricey">$$$</span>}
						</span>
						<Tier tier={m.tier}/>
					</button>
				))}
				{!filteredModels.length && <div className="nmo-md-empty" role="status">Модели не найдены</div>}
			</div>
		</div>
	);

	return (
		<div className={cn('nmo-md', {open})} ref={wrapRef}>
			<button type="button"
				ref={buttonRef}
				className="nmo-md-selected"
				aria-haspopup="listbox"
				aria-expanded={open}
				disabled={disabled}
				onClick={toggle}>
				<span className="nmo-md-name">
					<span>{current?.name ?? model}</span>
					{current?.tag === 'rec' && <IconStar size={10} className="nmo-md-rec"/>}
					{current?.tag === 'pricey' && <span className="nmo-md-pricey">$$$</span>}
				</span>
				<span className="nmo-md-meta">
					{current && <Tier tier={current.tier}/>}
					<IconChevronDown size={14} className="nmo-md-chev"/>
				</span>
			</button>

			{open && createPortal(list, document.body)}
		</div>
	);
};

export default ModelDropdown;

const TIER_LABEL: Record<string, string> = {
	low:    'LOW',
	medium: 'MED',
	high:   'HIGH',
	ultra:  'ULTRA',
};

const Tier: React.FC<{tier: IAiModel['tier']}> = ({tier}) => (
	<span className={cn('nmo-tier', tier)}>{TIER_LABEL[tier] ?? tier.toUpperCase()}</span>
);
