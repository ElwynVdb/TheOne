import fs from "fs";
import { Express } from "express-serve-static-core";
import { Quiz } from "./quiz";
import { Database } from "./database";
import { SessionManager } from "./sessionmanager";


export class Pages {

    private static readonly views: string[] = fs.readdirSync("./views/").map(s => s.replace(".ejs", ""));


    public static registerViewLinks(app: Express): void {

        // Index
        app.get("/", async (req, res) => {
            res.type("text/html");
            res.status(200);

           await SessionManager.createSession(req.session);
           await SessionManager.hasSession(req.session);

            res.render("index", { title: "Index" });
        });

        // Quiz get
        app.get("/quiz", (req, res) => {
            res.type("text/html");
            res.status(200);
            Quiz.process(req, res);
        });

        // Quiz post
        app.post("/quiz", (req, res) => {
            res.type("text/html");
            res.status(200);
            Quiz.process(req, res);
        });

        // Favorites
        app.get("/favorites", (req, res) => {
            res.type("text/html");
            res.status(200);
            res.render("favorites", { title: "Favorites" });
        }); 

        // Blacklist
        app.get("/blacklist", (req, res) => {
            res.type("text/html");
            res.status(200);
            res.render("blacklist", { title: "Blacklist" });
        });

        // Not found, send 404 page
        app.use((req, res) => {
            SessionManager.createSession(req.session);
            res.status(404);
            res.render('404');
        });
    }
}

export interface PageData {
    title?: string,

}