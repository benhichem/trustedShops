import axios from "axios";
import * as cheerio from "cheerio";
import fs from "node:fs"


async function GetAllPages(data: string) {
    const FinalPages: Array<string> = [];
    const pageLinks: Array<string> = [];
    try {
        const $ = cheerio.load(data);
        $('div.Paginationstyles__Pagination-sc-1uibxtv-0 a').each((i, el) => {
            let link = $(el).attr('href'); /* pageLinks.push($(el).attr('href')!) */
            if (link) {
                if (link.includes('page')) {
                    pageLinks.push(link)
                }
            }
        })

        console.log(pageLinks);

        if (pageLinks.length > 0) {
            let pageNumbers = pageLinks.map((item) => {
                let number = item.split('page=')

                return eval(number[1])
            })
            let biggestNumber = Math.max(...pageNumbers);
            console.log(biggestNumber)
            let url = pageLinks[0].split('=');

            for (let index = 1; index <= biggestNumber; index++) {
                FinalPages.push(`${url[0]}=${index}`)
            }

            return FinalPages
        }

    } catch (error) {
        throw error
    }
}

async function GetShopUrls(data: string) {
    try {
        let pageLinks: Array<string> = [];
        const $ = cheerio.load(data);
        $('main > a').each((i, el) => {
            let link = $(el).attr("href");

            if (link) {
                pageLinks.push(link)
            }
        })

        return pageLinks
    } catch (error) {
        throw error
    }
}
type ShopData = {
    name: string;
    websiteUrl: string;
    phonenumber: string;
    streetAddress: string;
    addressLocality: string;
    postalCode: string
    adressCounty: string
    /* email: string */
}

async function scrapeShop(url: string): Promise<ShopData | null> {
    try {
        // Initialize default shop data
        let dataShop: ShopData = {
            name: "",
            websiteUrl: "",
            phonenumber: "",
            streetAddress: "",
            addressLocality: "",
            postalCode: "",
            adressCounty: ""
        };

        // Fetch the page data
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 5000
        });

        const $ = cheerio.load(response.data);

        // Find all JSON-LD scripts
        const scripts = $('script[type="application/ld+json"]');

        if (scripts.length === 0) {
            console.warn('No JSON-LD scripts found on the page');
            return null;
        }

        // Process each script until we find valid shop data
        for (let i = 0; i < scripts.length; i++) {
            try {
                const content = $(scripts[i]).html();
                if (!content) continue;

                const parsed = JSON.parse(content);

                // Handle both single object and @graph array cases
                const shopInfo = parsed['@graph'] ?
                    parsed['@graph'].find((item: any) =>
                        item['@type'] === 'LocalBusiness' ||
                        item['@type'] === 'Store' ||
                        item['@type'] === 'Organization'
                    ) : parsed;

                if (!shopInfo) continue;

                // Extract address information
                const address = shopInfo.address || {};

                // Update shop data with found information
                dataShop = {
                    name: shopInfo.name || "",
                    websiteUrl: shopInfo.url || shopInfo.website || "",
                    phonenumber: shopInfo.telephone || shopInfo.phone || "",
                    streetAddress: address.streetAddress || "",
                    addressLocality: address.addressLocality || "",
                    postalCode: address.postalCode || "",
                    adressCounty: address.addressRegion || address.addressCountry || "",

                };

                // If we found valid data, break the loop
                if (dataShop.name || dataShop.websiteUrl) {
                    break;
                }
            } catch (parseError) {
                console.error(`Error parsing JSON-LD script ${i}:`, parseError);
                continue;
            }
        }

        // Validate if we found any meaningful data
        if (!dataShop.name && !dataShop.websiteUrl) {
            console.warn('No valid shop data found in JSON-LD scripts');
            return null;
        }

        return dataShop;

    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                console.error('Request timeout:', url);
            } else if (error.response) {
                console.error(`HTTP Error ${error.response.status}:`, url);
            } else if (error.request) {
                console.error('No response received:', url);
            }
        } else {
            console.error('Unexpected error:', error);
        }
        return null;
    }
}
/* const url = "https://www.trustedshops.nl/shops/drogisterij_cosmetica" */
const url_pl = "https://www.trustedshops.pl/shops/kosmetyki"
async function Main(url: string) {
    let baseUrl = url.split('/shops/');
    console.log(baseUrl);
    const links: Array<any> = []
    const response = (await axios.get(url)).data
    /*     console.log(response) */
    // Load the HTML content into cheerio
    /* const $ = cheerio.load(response);
    */

    const URLS = await GetAllPages(response);
    if (!URLS) throw new Error('Failed To scrape pages ...');
    for (let index = 0; index < 1/* URLS.length */; index++) {
        const element = URLS[index];
        console.log(`[+] Scraping url :: ${element}`);
        const response = (await axios.get(`${baseUrl[0]}/${element}`)).data;
        const shopUrls = await GetShopUrls(response);
        /*  console.log(shopUrls[0])
  */    console.log("shops urls are :: ", shopUrls.length);
        fs.writeFileSync('x.txt', JSON.stringify(shopUrls))

        for (let index2 = 0; index2 < shopUrls.length; index2++) {
            try {
                const element = shopUrls[index];
                console.log(index2, " :: ", element);
                //if (element === undefined) continue
                let data = await scrapeShop(element);
                console.log(data);
                if (data === null) break;
            } catch (error) {
                break;
            }
        }
    }

    console.log(links)
}

Main(url_pl)