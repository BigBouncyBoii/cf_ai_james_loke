import { Env } from '../types';
import puppeteer from '@cloudflare/puppeteer';

export async function handleTestBrowserbase(request: Request, env: Env): Promise<Response> {
	try {
		console.log('Testing Browserbase connection...');
		
		if (!env.BROWSERBASE_API_KEY) {
			return new Response(JSON.stringify({ 
				error: 'BROWSERBASE_API_KEY not found',
				hasKey: false 
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		console.log('API key found, connecting to Browserbase...');
		
		const browser = await puppeteer.connect({
			browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${env.BROWSERBASE_API_KEY}`,
		});

		console.log('Connected to Browserbase, opening page...');
		const page = await browser.newPage();
		
		console.log('Navigating to example.com...');
		await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
		
		const title = await page.title();
		console.log('Page title:', title);
		
		await browser.close();
		console.log('Browser closed successfully');

		return new Response(JSON.stringify({
			success: true,
			title,
			message: 'Browserbase connection successful'
		}), {
			headers: { 'Content-Type': 'application/json' },
		});

	} catch (error) {
		console.error('Browserbase test failed:', error);
		return new Response(JSON.stringify({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			details: error instanceof Error ? error.stack : 'No stack trace'
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}