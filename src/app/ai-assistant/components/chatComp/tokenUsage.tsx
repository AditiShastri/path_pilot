"use client";

import { useMemo, useState } from "react";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ChartNoAxesColumn } from "lucide-react";

type UsageRecord = {
	index: number;
	id: string;
	role: string;
	usage: {
		inputTokens: number;
		cachedInputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
};

function getUsageRecords(messages: UIMessage[]): UsageRecord[] {
	return messages
		.map((message: any, index: number) => {
			const usage = message?.metadata?.usage;
			if (!usage) return null;

			const noCacheTokens =
				usage?.inputTokenDetails?.noCacheTokens !== undefined
					? usage.inputTokenDetails.noCacheTokens
					: usage.inputTokens - (usage.cachedInputTokens ?? 0);

			const cachedTokens =
				usage?.cachedInputTokens ?? usage?.inputTokenDetails?.cacheReadTokens ?? 0;

			return {
				index: index + 1,
				id: message.id,
				role: message.role,
				usage: {
					inputTokens: noCacheTokens,
					cachedInputTokens: cachedTokens,
					outputTokens: usage?.outputTokens ?? 0,
					totalTokens: usage?.totalTokens ?? 0,
				},
			};
		})
		.filter(Boolean) as UsageRecord[];
}

function getUsageTotals(records: UsageRecord[]) {
	return records.reduce(
		(acc, record) => {
			acc.inputTokens += record.usage.inputTokens;
			acc.cachedInputTokens += record.usage.cachedInputTokens;
			acc.outputTokens += record.usage.outputTokens;
			acc.totalTokens += record.usage.totalTokens;
			return acc;
		},
		{
			inputTokens: 0,
			cachedInputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		},
	);
}

export function TokenUsageDialog({ messages }: { messages: UIMessage[] }) {
	const [open, setOpen] = useState(false);

	const usageRecords = useMemo(() => getUsageRecords(messages), [messages]);
	const usageTotals = useMemo(() => getUsageTotals(usageRecords), [usageRecords]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					className="gap-2 rounded-lg text-foreground hover:text-foreground"
					aria-label="View chat usage"
				>
					<ChartNoAxesColumn className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
				<DialogHeader className="shrink-0">
					<DialogTitle>Chat Usage</DialogTitle>
					<DialogDescription>
						Token usage for this conversation is stored temporarily in memory.
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-4 gap-3 shrink-0">
					<div className="rounded-lg border px-3 py-2">
						<p className="text-xs text-muted-foreground">Prompt</p>
						<p className="text-lg font-semibold">{usageTotals.inputTokens}</p>
					</div>
					<div className="rounded-lg border px-3 py-2">
						<p className="text-xs text-muted-foreground">Cache</p>
						<p className="text-lg font-semibold">{usageTotals.cachedInputTokens}</p>
					</div>
					<div className="rounded-lg border px-3 py-2">
						<p className="text-xs text-muted-foreground">Reply</p>
						<p className="text-lg font-semibold">{usageTotals.outputTokens}</p>
					</div>
					<div className="rounded-lg border px-3 py-2">
						<p className="text-xs text-muted-foreground">Total</p>
						<p className="text-lg font-semibold">{usageTotals.totalTokens}</p>
					</div>
				</div>
				{usageRecords.length === 0 ? (
					<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
						No usage data yet. Send a message to populate usage stats.
					</div>
				) : (
					<div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
						<Table className="w-full">
							<TableHeader className="sticky top-0 bg-background z-10">
								<TableRow>
									<TableHead className="w-16">Turn</TableHead>
									<TableHead className="w-24">Role</TableHead>
									<TableHead className="text-right">Prompt</TableHead>
									<TableHead className="text-right">Cached</TableHead>
									<TableHead className="text-right">Reply</TableHead>
									<TableHead className="text-right">Total</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{usageRecords.map((record) => (
									<TableRow key={record.id}>
										<TableCell>{record.index - 1}</TableCell>
										<TableCell className="capitalize">{record.role}</TableCell>
										<TableCell className="text-right">{record.usage.inputTokens ?? 0}</TableCell>
										<TableCell className="text-right">{record.usage.cachedInputTokens ?? 0}</TableCell>
										<TableCell className="text-right">{record.usage.outputTokens ?? 0}</TableCell>
										<TableCell className="text-right">{record.usage.totalTokens ?? 0}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
