#![no_std]
#![no_main]

extern crate alloc;

use alloc::{format, string::String};
use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    contracts::{EntryPoint, EntryPointAccess, EntryPointType, EntryPoints, NamedKeys, Parameter},
    runtime_args, ApiError, CLType, Key, RuntimeArgs, URef, U512,
};

const PROJECT_COUNT: &str = "project_count";
const OWNER: &str = "owner";
const ORACLE: &str = "oracle";
const CREATORS: &str = "creators";
const THRESHOLDS: &str = "thresholds";
const SCORES: &str = "scores";
const PROOFS: &str = "proofs";
const FUNDS: &str = "funds";
const PURSES: &str = "purses";
const RELEASED: &str = "released";

#[repr(u16)]
enum Error {
    Unauthorized = 1,
    InvalidThreshold = 2,
    InvalidScore = 3,
    AlreadyReleased = 4,
    BelowThreshold = 5,
}

fn revert(error: Error) -> ! {
    runtime::revert(ApiError::User(error as u16))
}

fn project_key(id: u32) -> String {
    format!("{}", id)
}

fn dictionary<T: casper_types::bytesrepr::FromBytes + casper_types::CLTyped>(
    name: &str,
    id: u32,
) -> T {
    storage::dictionary_get(name, &project_key(id))
        .unwrap_or_revert()
        .unwrap_or_revert()
}

fn caller_key() -> Key {
    Key::Account(runtime::get_caller())
}

fn assert_creator(project_id: u32) {
    let creator: Key = dictionary(CREATORS, project_id);
    if creator != caller_key() {
        revert(Error::Unauthorized);
    }
}

#[no_mangle]
pub extern "C" fn create_project() {
    let threshold: u32 = runtime::get_named_arg("threshold");
    if !(1..=100).contains(&threshold) {
        revert(Error::InvalidThreshold);
    }

    let count_uref = runtime::get_key(PROJECT_COUNT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let project_id = storage::read::<u32>(count_uref).unwrap_or_revert().unwrap_or(0) + 1;
    storage::write(count_uref, project_id);

    let key = project_key(project_id);
    storage::dictionary_put(CREATORS, &key, caller_key());
    storage::dictionary_put(THRESHOLDS, &key, threshold);
    storage::dictionary_put(SCORES, &key, 0u32);
    storage::dictionary_put(PROOFS, &key, String::new());
    storage::dictionary_put(FUNDS, &key, U512::zero());
    storage::dictionary_put(PURSES, &key, system::create_purse());
    storage::dictionary_put(RELEASED, &key, false);
    runtime::ret(casper_types::CLValue::from_t(project_id).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn fund_project() {
    let project_id: u32 = runtime::get_named_arg("project_id");
    let source_purse: URef = runtime::get_named_arg("source_purse");
    let amount: U512 = runtime::get_named_arg("amount");
    let target_purse: URef = dictionary(PURSES, project_id);

    system::transfer_from_purse_to_purse(source_purse, target_purse, amount, None)
        .unwrap_or_revert();

    let current: U512 = dictionary(FUNDS, project_id);
    storage::dictionary_put(FUNDS, &project_key(project_id), current + amount);
}

#[no_mangle]
pub extern "C" fn submit_proof() {
    let project_id: u32 = runtime::get_named_arg("project_id");
    assert_creator(project_id);
    let proof: String = runtime::get_named_arg("proof");
    storage::dictionary_put(PROOFS, &project_key(project_id), proof);
}

#[no_mangle]
pub extern "C" fn submit_score() {
    let oracle = runtime::get_key(ORACLE).unwrap_or_revert();
    if oracle != caller_key() {
        revert(Error::Unauthorized);
    }
    let project_id: u32 = runtime::get_named_arg("project_id");
    let score: u32 = runtime::get_named_arg("score");
    if score > 100 {
        revert(Error::InvalidScore);
    }
    storage::dictionary_put(SCORES, &project_key(project_id), score);
}

#[no_mangle]
pub extern "C" fn release() {
    let project_id: u32 = runtime::get_named_arg("project_id");
    let released: bool = dictionary(RELEASED, project_id);
    if released {
        revert(Error::AlreadyReleased);
    }
    let score: u32 = dictionary(SCORES, project_id);
    let threshold: u32 = dictionary(THRESHOLDS, project_id);
    if score < threshold {
        revert(Error::BelowThreshold);
    }

    let creator: Key = dictionary(CREATORS, project_id);
    let account = creator.into_account().unwrap_or_revert();
    let purse: URef = dictionary(PURSES, project_id);
    let amount: U512 = dictionary(FUNDS, project_id);

    storage::dictionary_put(RELEASED, &project_key(project_id), true);
    storage::dictionary_put(FUNDS, &project_key(project_id), U512::zero());
    system::transfer_from_purse_to_account(purse, account, amount, None).unwrap_or_revert();
}

fn entry_points() -> EntryPoints {
    let mut points = EntryPoints::new();
    points.add_entry_point(EntryPoint::new(
        "create_project",
        vec![Parameter::new("threshold", CLType::U32)],
        CLType::U32,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    points.add_entry_point(EntryPoint::new(
        "fund_project",
        vec![
            Parameter::new("project_id", CLType::U32),
            Parameter::new("source_purse", CLType::URef),
            Parameter::new("amount", CLType::U512),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    points.add_entry_point(EntryPoint::new(
        "submit_proof",
        vec![
            Parameter::new("project_id", CLType::U32),
            Parameter::new("proof", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    points.add_entry_point(EntryPoint::new(
        "submit_score",
        vec![
            Parameter::new("project_id", CLType::U32),
            Parameter::new("score", CLType::U32),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    points.add_entry_point(EntryPoint::new(
        "release",
        vec![Parameter::new("project_id", CLType::U32)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    points
}

#[no_mangle]
pub extern "C" fn call() {
    let owner = caller_key();
    let oracle: Key = runtime::get_named_arg("oracle");
    let mut named_keys = NamedKeys::new();
    named_keys.insert(OWNER.into(), owner);
    named_keys.insert(ORACLE.into(), oracle);
    named_keys.insert(PROJECT_COUNT.into(), storage::new_uref(0u32).into());

    for name in [CREATORS, THRESHOLDS, SCORES, PROOFS, FUNDS, PURSES, RELEASED] {
        named_keys.insert(name.into(), storage::new_dictionary(name).unwrap_or_revert().into());
    }

    let (package_hash, _) = storage::create_contract_package_at_hash();
    let (contract_hash, _) = storage::add_contract_version(package_hash, entry_points(), named_keys);
    runtime::put_key("arbit_contract", contract_hash.into());
    runtime::put_key("arbit_package", package_hash.into());
}
