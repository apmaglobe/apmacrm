import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {login} from "./auth";

const fixtures=JSON.parse(readFileSync(process.env.APMA_FIXTURE_FILE??".local/fixture.json","utf8"));

test("admin creates a missing customer and assigns several deal works to To Do",async({page,browser})=>{
  test.setTimeout(90000);
  await login(page,0);
  const title=`Bravo Market · ${Date.now()}`,customer=`Bravo Market ${Date.now()}`;
  await page.goto("/workspace/crm");
  await page.getByRole("button",{name:"Yeni qutu",exact:true}).click();
  await page.getByLabel("Qutu adı",{exact:true}).fill(title);
  await page.getByLabel("Müəssisə axtarışı",{exact:true}).fill(customer);
  await page.getByRole("button",{name:`“${customer}” adlı yeni müəssisə əlavə et`,exact:true}).click();
  const customerDialog=page.getByRole("dialog").filter({has:page.getByRole("heading",{name:"Yeni müəssisə",exact:true})});
  await customerDialog.getByRole("button",{name:"Müəssisəni əlavə et",exact:true}).click();
  await expect(customerDialog).toHaveCount(0);
  await page.getByLabel("İş / xidmət",{exact:true}).fill("Çəkiliş");
  await page.getByLabel("Departament",{exact:true}).selectOption({index:1});
  await page.getByLabel("İşin cavabdehi",{exact:true}).selectOption(fixtures[0].users[1].member);
  await page.getByRole("button",{name:"İş əlavə et",exact:true}).click();
  await page.getByLabel("İş / xidmət 2",{exact:true}).fill("Meta Manager");
  await page.getByLabel("Departament 2",{exact:true}).selectOption({index:1});
  await page.getByLabel("İşin cavabdehi 2",{exact:true}).selectOption(fixtures[0].users[0].member);
  await page.getByRole("button",{name:"Qutunu yarat",exact:true}).click();
  await expect(page.getByRole("dialog").getByText("Çəkiliş",{exact:true})).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Meta Manager",{exact:true})).toBeVisible();
  const employee=await browser.newContext();
  const employeePage=await employee.newPage();
  try{
    await login(employeePage,1);
    await employeePage.goto("/workspace/todo");
    await expect(employeePage.getByRole("cell",{name:"Çəkiliş",exact:true}).first()).toBeVisible({timeout:15000});
  }finally{await employee.close();}
});
